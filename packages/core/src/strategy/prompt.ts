import type { AggregatedData } from "./types.js";

export function buildStrategyPrompt(data: AggregatedData): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert SEO strategist. You analyze website data and produce actionable, prioritized SEO strategies.

You MUST respond with ONLY a valid JSON object matching this exact schema — no markdown, no explanation, no wrapping:

{
  "generatedAt": "<ISO 8601 timestamp>",
  "overallScore": <0-100 integer>,
  "quickWins": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "filePath?": "<string>" }],
  "contentPlan": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "targetKeyword": "<string>", "estimatedVolume?": <number>, "currentPage": "<string>"|null }],
  "technicalFixes": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "url": "<string>", "issueType": "<string>" }],
  "linkBuilding": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "targetDomains?": ["<string>"], "anchorStrategy?": "<string>" }],
  "drPlan": { "currentDR": <number>, "targetDR": <number>, "actions": ["<string>"] },
  "competitorInsights": ["<string>"]
}

Rules:
- overallScore: 0 = terrible SEO health, 100 = excellent
- quickWins: high impact + low effort items, aim for 3-7 items
- contentPlan: pages to create or improve, aim for 3-5 items
- technicalFixes: prioritized by impact, from crawl data
- linkBuilding: niche-relevant tactics, 2-4 items
- drPlan: realistic 6-month target based on current DR
- competitorInsights: 2-5 key findings`;

  const userPrompt = `Analyze this SEO data and generate a strategy:

## Project
- Domain: ${data.project.domain}
- Name: ${data.project.name}
${data.project.niche ? `- Niche: ${data.project.niche}` : ""}
${data.project.competitors?.length ? `- Competitors: ${data.project.competitors.join(", ")}` : ""}
${data.project.locale ? `- Locale: ${data.project.locale}` : ""}

## Keywords
- Total keywords: ${data.keywords.total}
- Tracked keywords: ${data.keywords.tracked}
- Average position: ${data.keywords.avgPosition ?? "N/A"}
- Keywords in top 10: ${data.keywords.top10Count}

## Pages (Crawl Data)
- Total pages: ${data.pages.total}
- Missing title: ${data.pages.missingTitle}
- Missing meta description: ${data.pages.missingDescription}
- Missing H1: ${data.pages.missingH1}
- Thin content (< 300 words): ${data.pages.thinContent}
- Average word count: ${Math.round(data.pages.avgWordCount)}
- Broken pages (4xx/5xx): ${data.pages.brokenLinks}

## Backlinks
- Total backlinks: ${data.backlinks.total}
- Unique referring domains: ${data.backlinks.uniqueDomains}
- Dofollow ratio: ${(data.backlinks.dofollowRatio * 100).toFixed(1)}%

## Domain Rating
- Current DR: ${data.domainRating.current ?? "N/A"}
- Previous DR: ${data.domainRating.previous ?? "N/A"}
- Trend: ${data.domainRating.trend}

## Google Search Console (last 28 days)
- Total clicks: ${data.gsc.totalClicks}
- Total impressions: ${data.gsc.totalImpressions}
- Average CTR: ${(data.gsc.avgCtr * 100).toFixed(2)}%
- Average position: ${data.gsc.avgPosition.toFixed(1)}

Respond with the JSON strategy object only.`;

  return { systemPrompt, userPrompt };
}
