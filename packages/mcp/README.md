# seoagent-mcp

MCP server for [SEOAgent](https://github.com/yagomp/seoagent) — 24 tools for AI agents to perform keyword research, rank tracking, site audits, competitor analysis, backlink intelligence, and SEO strategy generation.

Works with Claude, Cursor, Codex, Gemini, and any MCP-compatible AI client.

## Install & Connect

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seoagent": {
      "command": "npx",
      "args": ["seoagent-mcp"],
      "env": {
        "SEOAGENT_PROJECT": "mysite"
      }
    }
  }
}
```

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "seoagent": {
    "command": "npx",
    "args": ["seoagent-mcp"],
    "env": {
      "SEOAGENT_PROJECT": "mysite"
    }
  }
}
```

### Cursor / Other MCP clients

```json
{
  "mcpServers": {
    "seoagent": {
      "command": "npx",
      "args": ["seoagent-mcp"]
    }
  }
}
```

## Available Tools (24)

| Tool | Description |
|------|-------------|
| `seoagent_projects_list` | List all SEOAgent projects |
| `seoagent_project_add` | Create a new project |
| `seoagent_config_set` | Set a config value |
| `seoagent_audit_crawl` | Crawl a site and detect SEO issues |
| `seoagent_audit_page` | Audit a single URL |
| `seoagent_audit_report` | Get scored audit report with issues |
| `seoagent_keyword_research` | Search volumes, difficulty, CPC |
| `seoagent_keyword_suggestions` | Related keyword ideas from a seed |
| `seoagent_rank_track_add` | Add keywords to rank tracking |
| `seoagent_rank_track_check` | Fetch current SERP positions |
| `seoagent_rank_track_report` | Movers, gainers, losers |
| `seoagent_rank_track_history` | Position history for a keyword |
| `seoagent_competitor_keywords` | Keywords a competitor ranks for |
| `seoagent_competitor_compare` | Side-by-side keyword comparison |
| `seoagent_content_gaps` | Keywords competitors rank for that you don't |
| `seoagent_domain_reputation` | DR score, backlinks, referring domains |
| `seoagent_domain_reputation_history` | DR trend over time |
| `seoagent_backlink_profile` | Full backlink profile |
| `seoagent_backlink_opportunities` | Link building targets |
| `seoagent_gsc_performance` | GSC clicks, impressions, CTR, position |
| `seoagent_gsc_queries` | Top queries from Search Console |
| `seoagent_gsc_pages` | Top pages from Search Console |
| `seoagent_strategy_generate` | Generate AI or rule-based SEO strategy |
| `seoagent_strategy_refresh` | Re-run strategy with latest data |

## Example prompts

Once connected, ask your agent:

```
Do a full audit of mysite.com and tell me what to fix first.
```
```
Research keywords for "fantasy football app" and start tracking the best ones.
```
```
What are the content gaps between my site and competitor.com?
```
```
Generate a 90-day SEO strategy based on my current audit and keyword data.
```
```
Which of my pages get the most impressions but low CTR in Search Console?
```
```
My organic traffic dropped — help me diagnose why using audit data and rank history.
```

## Updating

`npx` fetches the latest version automatically. To force-refresh a cached version:

```bash
npx --yes seoagent-mcp@latest
```

Or clear the npx cache:

```bash
npx clear-npx-cache
```

## Requirements

- Node.js >= 20
- DataForSEO account for keyword/SERP/backlink data (~$0.001/query)
- Optional: Google Search Console credentials, LLM API key for strategy

## Links

- [GitHub](https://github.com/yagomp/seoagent)
- [CLI (`@seoagent/cli`)](https://www.npmjs.com/package/@seoagent/cli)
- [Core library (`@seoagent/core`)](https://www.npmjs.com/package/@seoagent/core)
- [Full documentation](https://github.com/yagomp/seoagent#readme)

## License

MIT
