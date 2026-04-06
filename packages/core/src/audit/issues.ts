import type { PageData, PageIssue, AuditDuplicate } from "../types.js";

const THIN_CONTENT_THRESHOLD = 200;

export function detectPageIssues(page: PageData): PageIssue[] {
  const issues: PageIssue[] = [];

  if (!page.title) {
    issues.push({
      type: "missing_title",
      message: "Page is missing a <title> tag",
      severity: "error",
    });
  }

  if (!page.metaDescription) {
    issues.push({
      type: "missing_meta_description",
      message: "Page is missing a meta description",
      severity: "warning",
    });
  }

  if (!page.h1) {
    issues.push({
      type: "missing_h1",
      message: "Page is missing an <h1> tag",
      severity: "warning",
    });
  }

  if (page.wordCount < THIN_CONTENT_THRESHOLD) {
    issues.push({
      type: "thin_content",
      message: `Page has only ${page.wordCount} words (minimum ${THIN_CONTENT_THRESHOLD})`,
      severity: "warning",
    });
  }

  if (page.statusCode >= 400) {
    issues.push({
      type: "broken_link",
      message: `Page returned HTTP ${page.statusCode}`,
      severity: "error",
    });
  }

  if (page.imagesWithoutAlt > 0) {
    issues.push({
      type: "images_without_alt",
      message: `${page.imagesWithoutAlt} image(s) missing alt text`,
      severity: "warning",
    });
  }

  if (page.redirectChain && page.redirectChain.length > 1) {
    issues.push({
      type: "redirect_chain",
      message: `Redirect chain with ${page.redirectChain.length} hops`,
      severity: "warning",
    });
  }

  return issues;
}

export function detectDuplicateTitles(pages: PageData[]): AuditDuplicate[] {
  const titleMap = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.title) continue;
    const existing = titleMap.get(page.title) ?? [];
    existing.push(page.url);
    titleMap.set(page.title, existing);
  }

  const duplicates: AuditDuplicate[] = [];
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      duplicates.push({ title, urls });
    }
  }

  return duplicates;
}

export function detectOrphanPages(
  pages: PageData[],
  seedUrl: string
): string[] {
  // Build set of all URLs that receive at least one internal link
  const linkedUrls = new Set<string>();
  for (const page of pages) {
    for (const link of page.internalLinks) {
      linkedUrls.add(link.href);
    }
  }

  // A page is an orphan if it has no incoming links and is not the seed URL
  const orphans: string[] = [];
  for (const page of pages) {
    if (page.url === seedUrl) continue;
    if (!linkedUrls.has(page.url)) {
      orphans.push(page.url);
    }
  }

  return orphans;
}
