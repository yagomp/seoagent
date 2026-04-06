import type Database from "better-sqlite3";
import { fetchPage } from "./fetcher.js";
import { parseRobotsTxt } from "./robots.js";
import { CrawlQueue } from "./crawler.js";
import { fetchSitemapUrls } from "./sitemap.js";
import { detectPageIssues, detectDuplicateTitles, detectOrphanPages } from "./issues.js";
import type { CrawlOptions, CrawlStats } from "../types.js";

const DEFAULT_MAX_PAGES = 500;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_USER_AGENT = "SEOAgent/1.0";

export async function auditCrawl(
  domain: string,
  db: Database.Database,
  options: CrawlOptions = {}
): Promise<CrawlStats> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const startTime = Date.now();

  // Clear previous crawl data
  db.prepare("DELETE FROM crawl_links").run();
  db.prepare("DELETE FROM crawl_pages").run();

  // Fetch robots.txt
  let robotsContent = "";
  try {
    const robotsResult = await fetchPage(
      `https://${domain}/robots.txt`,
      userAgent
    );
    if (robotsResult.statusCode === 200) {
      robotsContent = robotsResult.body;
    }
  } catch {
    // robots.txt not available -- crawl everything
  }
  const robotsRules = parseRobotsTxt(robotsContent);

  // Build seed URL
  const seedUrl = `https://${domain}/`;

  // Discover URLs from sitemaps
  let sitemapUrls: string[] = [];
  const sitemapSources = robotsRules.sitemaps.length > 0
    ? robotsRules.sitemaps
    : [`https://${domain}/sitemap.xml`];

  for (const sitemapUrl of sitemapSources) {
    try {
      const urls = await fetchSitemapUrls(sitemapUrl, userAgent);
      sitemapUrls.push(...urls);
    } catch {
      // Sitemap not available — will crawl from homepage only
    }
  }

  // Filter sitemap URLs to same domain
  sitemapUrls = sitemapUrls.filter((url) => {
    try {
      return new URL(url).hostname === domain;
    } catch {
      return false;
    }
  });

  console.log(`Found ${sitemapUrls.length} URLs from sitemaps`);

  // Run crawler with sitemap URLs as additional seeds
  const queue = new CrawlQueue({
    domain,
    seedUrl,
    maxPages,
    concurrency,
    fetchFn: (url: string) => fetchPage(url, userAgent),
    robotsRules,
    sitemapUrls,
  });

  const crawlResults = await queue.run();

  // Detect per-page issues
  const allPages = crawlResults.map((r) => r.page);
  for (const page of allPages) {
    page.issues = detectPageIssues(page);
  }

  // Detect cross-page issues: duplicate titles
  const duplicateTitles = detectDuplicateTitles(allPages);
  for (const dupe of duplicateTitles) {
    for (const page of allPages) {
      if (dupe.urls.includes(page.url)) {
        page.issues.push({
          type: "duplicate_title",
          message: `Title "${dupe.title}" is shared with ${dupe.urls.length - 1} other page(s)`,
          severity: "warning",
        });
      }
    }
  }

  // Detect orphan pages
  const orphanUrls = detectOrphanPages(allPages, seedUrl);
  for (const page of allPages) {
    if (orphanUrls.includes(page.url)) {
      page.issues.push({
        type: "orphan_page",
        message: "Page has no incoming internal links",
        severity: "info",
      });
    }
  }

  // Store results in database
  const insertPage = db.prepare(`
    INSERT OR REPLACE INTO crawl_pages (url, status_code, title, meta_description, h1, word_count, load_time_ms, issues, crawled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertLink = db.prepare(`
    INSERT INTO crawl_links (source_url, target_url, anchor_text, is_internal, status_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTransaction = db.transaction(() => {
    for (const result of crawlResults) {
      const { page } = result;

      insertPage.run(
        page.url,
        page.statusCode,
        page.title,
        page.metaDescription,
        page.h1,
        page.wordCount,
        page.loadTimeMs,
        JSON.stringify(page.issues)
      );

      for (const link of result.internalLinks) {
        insertLink.run(page.url, link.href, link.anchor, 1, null);
      }

      for (const link of result.externalLinks) {
        insertLink.run(page.url, link.href, link.anchor, 0, null);
      }
    }
  });

  insertTransaction();

  // Compute stats
  let issuesFound = 0;
  let brokenLinks = 0;
  for (const page of allPages) {
    issuesFound += page.issues.length;
    if (page.statusCode >= 400) {
      brokenLinks++;
    }
  }

  return {
    pagesCrawled: allPages.length,
    issuesFound,
    brokenLinks,
    timeMs: Date.now() - startTime,
  };
}
