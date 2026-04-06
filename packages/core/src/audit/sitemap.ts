import * as cheerio from "cheerio";
import { fetchPage } from "./fetcher.js";

/**
 * Fetches and parses a sitemap (or sitemap index), returning all page URLs.
 * Handles sitemap indexes recursively.
 */
export async function fetchSitemapUrls(
  sitemapUrl: string,
  userAgent: string,
  maxDepth = 2
): Promise<string[]> {
  if (maxDepth <= 0) return [];

  try {
    const result = await fetchPage(sitemapUrl, userAgent);
    if (result.statusCode !== 200) return [];

    const $ = cheerio.load(result.body, { xmlMode: true });
    const urls: string[] = [];

    // Check if this is a sitemap index
    const sitemapLocs = $("sitemapindex sitemap loc");
    if (sitemapLocs.length > 0) {
      // Sitemap index — fetch each sub-sitemap
      const subSitemapUrls: string[] = [];
      sitemapLocs.each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) subSitemapUrls.push(loc);
      });

      // Fetch sub-sitemaps concurrently (batch of 5)
      for (let i = 0; i < subSitemapUrls.length; i += 5) {
        const batch = subSitemapUrls.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((url) => fetchSitemapUrls(url, userAgent, maxDepth - 1))
        );
        for (const r of results) urls.push(...r);
      }

      return urls;
    }

    // Regular sitemap — extract all <loc> entries
    $("urlset url loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });

    return urls;
  } catch {
    return [];
  }
}
