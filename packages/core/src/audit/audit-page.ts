import { fetchPage, parsePage } from "./fetcher.js";
import { detectPageIssues } from "./issues.js";
import type { PageData } from "../types.js";

const DEFAULT_USER_AGENT = "SEOAgent/1.0";

export async function auditPage(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<PageData> {
  const fetchResult = await fetchPage(url, userAgent);

  const parsed = parsePage(fetchResult.body, url);

  const page: PageData = {
    url,
    statusCode: fetchResult.statusCode,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    h1: parsed.h1,
    wordCount: parsed.wordCount,
    loadTimeMs: fetchResult.loadTimeMs,
    internalLinks: parsed.internalLinks,
    externalLinks: parsed.externalLinks,
    imagesWithoutAlt: parsed.imagesWithoutAlt,
    issues: [],
    redirectChain:
      fetchResult.redirectChain.length > 0
        ? fetchResult.redirectChain
        : undefined,
  };

  page.issues = detectPageIssues(page);

  return page;
}
