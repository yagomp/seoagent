---
name: seo-keywords
description: "Use when the user wants keyword research, keyword suggestions, rank tracking, or position monitoring. Triggers on: 'keyword research', 'keyword ideas', 'track rankings', 'rank tracking', 'position tracking', 'SERP', 'search volume', 'keyword difficulty'."
---

# Keyword Research & Rank Tracking with SEOAgent

Research keywords, get suggestions, and track search rankings using SEOAgent MCP tools.

## Prerequisites

- Active project (`seoagent_projects_list`)
- DataForSEO credentials configured (`seoagent_config_set` with `dataforseo.login` and `dataforseo.password`)

If credentials are missing, tell the user:
> You need a DataForSEO account (~$0.001/query). Sign up at dataforseo.com, then run:
> `seoagent config set dataforseo.login YOUR_LOGIN`
> `seoagent config set dataforseo.password YOUR_PASSWORD`

## Keyword Research

Get search volumes, difficulty scores, and CPC for keywords:

```
seoagent_keyword_research: { keywords: ["fpl tips", "fantasy premier league"], locale: "en-GB", project: "mysite" }
```

## Keyword Suggestions

Expand a seed keyword into related ideas:

```
seoagent_keyword_suggestions: { seed: "fantasy premier league", locale: "en-GB", limit: 50, project: "mysite" }
```

## Rank Tracking

### Add keywords to track
```
seoagent_rank_track_add: { keywords: ["best fpl app", "fpl tips"], project: "mysite" }
```

### Check current positions
```
seoagent_rank_track_check: { project: "mysite" }
```

### View position history
```
seoagent_rank_track_history: { keyword: "best fpl app", project: "mysite" }
```

### Get movers report (up/down/new/lost)
```
seoagent_rank_track_report: { project: "mysite" }
```

## Competitor Keywords

See what keywords a competitor ranks for:
```
seoagent_competitor_keywords: { domain: "competitor.com", locale: "en-GB", project: "mysite" }
```

## Content Gaps

Find keywords competitors rank for but you don't:
```
seoagent_content_gaps: { project: "mysite" }
```

## CLI Alternative

```bash
seoagent keywords research "fpl tips" "fantasy premier league" --locale en-GB
seoagent keywords suggest "fantasy premier league" --limit 50
seoagent keywords track add "best fpl app" "fpl tips"
seoagent keywords track check
seoagent keywords track report
seoagent competitor keywords competitor.com
seoagent content-gaps
```
