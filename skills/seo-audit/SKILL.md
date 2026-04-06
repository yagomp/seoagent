---
name: seo-audit
description: "Use when the user wants to audit, crawl, or diagnose SEO issues on their website. Triggers on: 'audit my site', 'crawl', 'SEO issues', 'broken links', 'missing meta', 'thin content', 'site health', 'technical SEO'."
---

# SEO Site Audit with SEOAgent

Perform comprehensive technical SEO audits using the SEOAgent MCP tools or CLI.

## Prerequisites

The user must have an active project. Check with `seoagent_projects_list`. If no project exists, create one with `seoagent_project_add`.

## Workflow

### 1. Set up project (if needed)

```
seoagent_project_add: { slug: "mysite", domain: "example.com", name: "My Site", niche: "tech" }
```

### 2. Crawl the site

Use `seoagent_audit_crawl` with appropriate maxPages:
- Small sites: 500 pages
- Medium sites: 2000 pages
- Large sites (5000+): 5000 pages

The crawler automatically discovers URLs from sitemaps AND follows internal links.

```
seoagent_audit_crawl: { maxPages: 5000, project: "mysite" }
```

### 3. Get the audit report

```
seoagent_audit_report: { project: "mysite" }
```

The report includes:
- **Issue counts by type**: missing titles, missing meta descriptions, missing H1, thin content, broken links, duplicate titles, orphan pages, redirect chains, images without alt text
- **Broken links list**: source URL → target URL + status code
- **Duplicate titles**: pages sharing the same title
- **Orphan pages**: pages with no internal links pointing to them

### 4. Audit a single page (optional)

```
seoagent_audit_page: { url: "https://example.com/specific-page", project: "mysite" }
```

Returns detailed per-page data: title, meta description, H1, word count, load time, internal/external links, images without alt, issues.

### 5. Present findings

Organize findings by priority:
1. **Critical**: Broken links (4xx/5xx), missing titles on key pages
2. **High**: Duplicate titles, missing meta descriptions, thin content (<200 words)
3. **Medium**: Missing H1, orphan pages, redirect chains
4. **Low**: Images without alt text

### CLI Alternative

If MCP tools are not available, use the CLI:
```bash
seoagent project add mysite --domain example.com
seoagent audit crawl --max-pages 5000
seoagent audit report
seoagent audit page https://example.com/page
```
