import * as cheerio from "cheerio";
import { request } from "undici";
import type { LinkData } from "../types.js";

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  imagesWithoutAlt: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
}

export interface FetchResult {
  statusCode: number;
  body: string;
  loadTimeMs: number;
  redirectChain: string[];
}

export function resolveUrl(href: string, baseUrl: string): string {
  try {
    const resolved = new URL(href, baseUrl);
    resolved.hash = "";
    // Keep trailing slashes as-is — they matter for redirects
    return resolved.toString();
  } catch {
    return href;
  }
}

export function parsePage(
  html: string,
  pageUrl: string
): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  // Word count: extract body text, split on whitespace
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  // Images without alt
  const images = $("img");
  let imagesWithoutAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === null) {
      imagesWithoutAlt++;
    }
  });

  const { internal, external } = extractLinks(html, pageUrl);

  return {
    title,
    metaDescription,
    h1,
    wordCount,
    imagesWithoutAlt,
    internalLinks: internal,
    externalLinks: external,
  };
}

export function extractLinks(
  html: string,
  pageUrl: string
): { internal: LinkData[]; external: LinkData[] } {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const internal: LinkData[] = [];
  const external: LinkData[] = [];

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    // Skip mailto, tel, javascript links
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

    const resolved = resolveUrl(rawHref, pageUrl);
    const anchor = $(el).text().trim();

    try {
      const linkUrl = new URL(resolved);
      if (linkUrl.hostname === base.hostname) {
        internal.push({ href: resolved, anchor });
      } else {
        external.push({ href: resolved, anchor });
      }
    } catch {
      // Skip invalid URLs
    }
  });

  return { internal, external };
}

export async function fetchPage(
  url: string,
  userAgent: string
): Promise<FetchResult> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  let statusCode = 0;
  let body = "";
  const start = Date.now();

  // Follow redirects manually to track the chain (max 10 hops)
  for (let i = 0; i < 10; i++) {
    const response = await request(currentUrl, {
      method: "GET",
      headers: { "user-agent": userAgent },
      maxRedirections: 0,
      headersTimeout: 10000,
      bodyTimeout: 10000,
    } as Parameters<typeof request>[1]);

    statusCode = response.statusCode;
    const location = response.headers.location;

    if (statusCode >= 300 && statusCode < 400 && location) {
      redirectChain.push(currentUrl);
      currentUrl = resolveUrl(
        Array.isArray(location) ? location[0] : location,
        currentUrl
      );
      // Consume the body to free the socket
      await response.body.text();
      continue;
    }

    body = await response.body.text();
    break;
  }

  const loadTimeMs = Date.now() - start;

  return { statusCode, body, loadTimeMs, redirectChain };
}
