import type Database from "better-sqlite3";
import type {
  AuditReport,
  AuditReportPage,
  AuditBrokenLink,
  AuditDuplicate,
  PageIssue,
} from "../types.js";

interface CrawlPageRow {
  url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  word_count: number;
  issues: string;
}

interface CrawlLinkRow {
  source_url: string;
  target_url: string;
  is_internal: number;
}

export function auditReport(db: Database.Database): AuditReport {
  const pageRows = db
    .prepare("SELECT url, status_code, title, meta_description, word_count, issues FROM crawl_pages")
    .all() as CrawlPageRow[];

  if (pageRows.length === 0) {
    return {
      totalPages: 0,
      issuesByType: {},
      pages: [],
      brokenLinks: [],
      duplicateTitles: [],
      orphanPages: [],
    };
  }

  // Build pages list and aggregate issues
  const issuesByType: Record<string, number> = {};
  const pages: AuditReportPage[] = [];

  for (const row of pageRows) {
    let issues: PageIssue[] = [];
    try {
      issues = JSON.parse(row.issues || "[]");
    } catch {
      issues = [];
    }

    for (const issue of issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] ?? 0) + 1;
    }

    pages.push({
      url: row.url,
      statusCode: row.status_code,
      title: row.title,
      metaDescription: row.meta_description,
      wordCount: row.word_count,
      issues,
    });
  }

  // Find broken links: internal links pointing to pages with 4xx/5xx
  const brokenPageUrls = new Map<string, number>();
  for (const row of pageRows) {
    if (row.status_code >= 400) {
      brokenPageUrls.set(row.url, row.status_code);
    }
  }

  const linkRows = db
    .prepare("SELECT source_url, target_url, is_internal FROM crawl_links WHERE is_internal = 1")
    .all() as CrawlLinkRow[];

  const brokenLinks: AuditBrokenLink[] = [];
  for (const link of linkRows) {
    const brokenStatus = brokenPageUrls.get(link.target_url);
    if (brokenStatus !== undefined) {
      brokenLinks.push({
        sourceUrl: link.source_url,
        targetUrl: link.target_url,
        statusCode: brokenStatus,
      });
    }
  }

  // Find duplicate titles
  const titleMap = new Map<string, string[]>();
  for (const row of pageRows) {
    if (!row.title) continue;
    const urls = titleMap.get(row.title) ?? [];
    urls.push(row.url);
    titleMap.set(row.title, urls);
  }

  const duplicateTitles: AuditDuplicate[] = [];
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      duplicateTitles.push({ title, urls });
    }
  }

  // Find orphan pages: pages with no incoming internal links (except first page)
  const allInternalTargets = new Set<string>();
  for (const link of linkRows) {
    allInternalTargets.add(link.target_url);
  }

  // First page in the table is assumed to be the seed
  const seedUrl = pageRows[0]?.url;
  const orphanPages: string[] = [];
  for (const row of pageRows) {
    if (row.url === seedUrl) continue;
    if (!allInternalTargets.has(row.url)) {
      orphanPages.push(row.url);
    }
  }

  return {
    totalPages: pageRows.length,
    issuesByType,
    pages,
    brokenLinks,
    duplicateTitles,
    orphanPages,
  };
}
