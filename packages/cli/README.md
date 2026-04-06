# @seoagent/cli

Command-line interface for [SEOAgent](https://github.com/yagomp/seoagent) — open-source, agent-first SEO toolkit.

## Install

```bash
npm install -g @seoagent/cli
```

Or with the one-liner (installs Node.js automatically if missing):

```bash
curl -fsSL https://raw.githubusercontent.com/yagomp/seoagent/main/scripts/install.sh | sh
```

Requires Node.js >= 20.

## Setup

```bash
# Create a project
seoagent project add mysite --domain example.com --niche "your niche"

# Add DataForSEO credentials (keyword/SERP/backlink data)
seoagent config set dataforseo.login YOUR_LOGIN
seoagent config set dataforseo.password YOUR_PASSWORD

# Optional: LLM for AI strategy generation
seoagent config set llm.provider anthropic
seoagent config set llm.apiKey sk-ant-...
seoagent config set llm.model claude-sonnet-4-6
```

## Commands

### Site Audit

```bash
seoagent audit crawl                    # Crawl entire site via sitemap + BFS
seoagent audit crawl --max-pages 500    # Limit crawl depth
seoagent audit page https://example.com/page  # Audit a single page
seoagent audit report                   # Show scored report with issues
seoagent audit report --format markdown # Export as markdown
```

### Keywords & Rank Tracking

```bash
seoagent keywords research "seo tips" "content marketing"
seoagent keywords suggestions "fantasy football"
seoagent keywords track add "best fpl app" "fpl tips"
seoagent keywords track check
seoagent keywords track report          # Movers, gainers, losers
seoagent keywords track history "best fpl app"
```

### Competitor Analysis

```bash
seoagent competitor keywords competitor.com
seoagent competitor compare competitor.com
seoagent content-gaps
```

### Domain Reputation & Backlinks

```bash
seoagent domain reputation              # DR score, backlinks
seoagent domain reputation --history    # Track DR over time
seoagent domain backlinks               # Full backlink profile
seoagent domain opportunities           # Link building targets
```

### Google Search Console

```bash
seoagent gsc auth --client-id ID --client-secret SECRET
seoagent gsc sync
seoagent gsc performance
seoagent gsc queries
seoagent gsc pages
```

### Strategy

```bash
seoagent strategy generate              # AI or rule-based strategy
seoagent strategy refresh               # Re-run with latest data
```

### Other

```bash
seoagent project list
seoagent project add mysite --domain example.com --niche "tech"
seoagent dashboard                      # Open local web UI at :3847
seoagent config set KEY VALUE
```

## Output formats

All commands support `--format table` (default), `--format json`, and `--format markdown`.

## Links

- [GitHub](https://github.com/yagomp/seoagent)
- [Core library (`@seoagent/core`)](https://www.npmjs.com/package/@seoagent/core)
- [MCP Server (`seoagent-mcp`)](https://www.npmjs.com/package/seoagent-mcp)
- [Full documentation](https://github.com/yagomp/seoagent#readme)

## License

MIT
