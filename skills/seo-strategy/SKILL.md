---
name: seo-strategy
description: "Use when the user wants an SEO strategy, action plan, or recommendations. Triggers on: 'SEO strategy', 'SEO plan', 'SEO recommendations', 'improve SEO', 'what should I fix', 'SEO roadmap', 'quick wins'."
---

# SEO Strategy Generation with SEOAgent

Generate comprehensive, data-driven SEO strategies using audit data, keyword data, and optionally LLM intelligence.

## Prerequisites

- Active project with crawl data (run `seoagent_audit_crawl` first)
- Optional: DataForSEO credentials for keyword/backlink data
- Optional: LLM configured for AI-powered strategy (`seoagent_config_set` with `llm.provider`, `llm.apiKey`)

Without an LLM, SEOAgent uses a rule-based engine that analyzes your audit data and generates actionable recommendations.

## Generate Strategy

```
seoagent_strategy_generate: { project: "mysite" }
```

Returns a structured strategy with:
- **Overall SEO Health Score** (0-100)
- **Quick Wins** — high impact, low effort actions with specific recommendations
- **Technical Fixes** — from audit data, prioritized by severity
- **Content Plan** — pages to create or improve
- **Link Building** — niche-relevant tactics
- **DR Growth Plan** — current DR → target DR with actions
- **Competitor Insights** — if competitors are configured

## Refresh Strategy (After Changes)

After making improvements, re-run to see what changed:

```
seoagent_strategy_refresh: { project: "mysite" }
```

Returns a diff: previous score vs current, improvements, regressions.

## Domain Reputation

Check backlink profile and domain authority:

```
seoagent_domain_reputation: { project: "mysite" }
seoagent_backlink_profile: { project: "mysite" }
seoagent_backlink_opportunities: { project: "mysite" }
```

## Google Search Console

Connect GSC for real traffic data:

```
seoagent_gsc_performance: { days: 28, project: "mysite" }
seoagent_gsc_pages: { sort: "clicks", project: "mysite" }
seoagent_gsc_queries: { days: 28, project: "mysite" }
```

## Recommended Workflow

1. `seoagent_audit_crawl` — crawl the site
2. `seoagent_audit_report` — see current issues
3. `seoagent_strategy_generate` — get prioritized action plan
4. Fix the issues identified
5. `seoagent_strategy_refresh` — verify improvements

## CLI Alternative

```bash
seoagent audit crawl --max-pages 5000
seoagent strategy generate
seoagent strategy refresh
seoagent domain reputation
seoagent domain backlinks
```
