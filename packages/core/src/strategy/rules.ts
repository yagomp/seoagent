import type { Strategy, ActionItem, ContentItem, AuditFix, LinkTactic, AggregatedData } from "./types.js";

export function generateRuleBasedStrategy(data: AggregatedData): Strategy {
  const quickWins: ActionItem[] = [];
  const contentPlan: ContentItem[] = [];
  const technicalFixes: AuditFix[] = [];
  const linkBuilding: LinkTactic[] = [];
  const competitorInsights: string[] = [];

  // === Quick Wins ===

  // No data at all — suggest running an audit
  if (data.pages.total === 0) {
    quickWins.push({
      action: "Run a site crawl/audit to collect baseline data",
      reason: "No crawl data exists yet — all recommendations depend on it",
      impact: "high",
      effort: "low",
    });
  }

  // Missing meta descriptions > 10%
  if (data.pages.total > 0 && data.pages.missingDescription / data.pages.total > 0.1) {
    quickWins.push({
      action: `Fix missing meta descriptions on ${data.pages.missingDescription} pages`,
      reason: `${((data.pages.missingDescription / data.pages.total) * 100).toFixed(0)}% of pages lack meta descriptions, reducing CTR in search results`,
      impact: "high",
      effort: "low",
    });
  }

  // Missing titles
  if (data.pages.total > 0 && data.pages.missingTitle > 0) {
    quickWins.push({
      action: `Add page titles to ${data.pages.missingTitle} pages`,
      reason: "Missing titles severely hurt search visibility and click-through rates",
      impact: "high",
      effort: "low",
    });
  }

  // Missing H1s
  if (data.pages.total > 0 && data.pages.missingH1 > 0) {
    quickWins.push({
      action: `Add H1 headings to ${data.pages.missingH1} pages`,
      reason: "H1 tags help search engines understand page topic and content hierarchy",
      impact: "medium",
      effort: "low",
    });
  }

  // Low CTR
  if (data.gsc.totalImpressions > 0 && data.gsc.avgCtr < 0.03) {
    quickWins.push({
      action: "Improve title tags and meta descriptions to boost CTR",
      reason: `Average CTR is ${(data.gsc.avgCtr * 100).toFixed(2)}% which is below the 3% benchmark — better titles/descriptions can double click rates`,
      impact: "high",
      effort: "medium",
    });
  }

  // No tracked keywords
  if (data.keywords.tracked === 0 && data.keywords.total === 0) {
    quickWins.push({
      action: "Research and track target keywords for your niche",
      reason: "No keywords are being tracked — keyword data drives content and ranking strategy",
      impact: "high",
      effort: "medium",
    });
  }

  // === Technical Fixes ===

  if (data.pages.brokenLinks > 0) {
    technicalFixes.push({
      action: `Fix ${data.pages.brokenLinks} broken pages returning 4xx/5xx errors`,
      reason: "Broken pages waste crawl budget and create poor user experience",
      impact: "high",
      effort: "low",
      url: data.project.domain,
      issueType: "broken_pages",
    });
  }

  if (data.pages.total > 0 && data.pages.thinContent > 0) {
    technicalFixes.push({
      action: `Expand ${data.pages.thinContent} thin content pages (< 300 words)`,
      reason: "Thin pages are less likely to rank and may be flagged as low quality",
      impact: "medium",
      effort: "medium",
      url: data.project.domain,
      issueType: "thin_content",
    });
  }

  // === Content Plan ===

  if (data.pages.total > 0 && data.pages.thinContent / data.pages.total > 0.15) {
    contentPlan.push({
      action: `Expand thin content pages — ${data.pages.thinContent} pages have fewer than 300 words`,
      reason: `${((data.pages.thinContent / data.pages.total) * 100).toFixed(0)}% of pages are thin content, avg word count is ${Math.round(data.pages.avgWordCount)}`,
      impact: "high",
      effort: "medium",
      targetKeyword: "",
      currentPage: null,
    });
  }

  if (data.keywords.total > 0 && data.keywords.top10Count < data.keywords.total * 0.2) {
    contentPlan.push({
      action: "Create dedicated landing pages for keywords outside top 10",
      reason: `Only ${data.keywords.top10Count} of ${data.keywords.total} keywords rank in the top 10 — targeted content can improve rankings`,
      impact: "high",
      effort: "high",
      targetKeyword: "",
      currentPage: null,
    });
  }

  // === Link Building ===

  const currentDR = data.domainRating.current ?? 0;

  if (currentDR < 20) {
    linkBuilding.push({
      action: "Start foundational link building — directories, profiles, and niche communities",
      reason: `DR of ${currentDR} is very low — foundational links establish baseline authority`,
      impact: "high",
      effort: "medium",
    });
    linkBuilding.push({
      action: "Create linkable assets (tools, research, infographics) to attract natural links",
      reason: "Low-DR sites need standout content to earn editorial links",
      impact: "high",
      effort: "high",
    });
  } else if (currentDR < 40) {
    linkBuilding.push({
      action: "Pursue guest posting and digital PR in niche publications",
      reason: `DR of ${currentDR} is moderate — targeted outreach can accelerate growth`,
      impact: "high",
      effort: "high",
    });
  }

  if (data.backlinks.total === 0) {
    linkBuilding.push({
      action: "Analyze competitor backlinks and replicate their best links",
      reason: "No backlinks detected — competitor backlink analysis reveals quick link opportunities",
      impact: "high",
      effort: "medium",
    });
  }

  // === DR Plan ===

  let targetDR: number;
  if (currentDR < 10) targetDR = 20;
  else if (currentDR < 20) targetDR = 35;
  else if (currentDR < 40) targetDR = 55;
  else targetDR = Math.min(currentDR + 15, 100);

  const drActions: string[] = [];
  if (currentDR < 30) drActions.push("Build niche-relevant backlinks consistently");
  if (currentDR < 50) drActions.push("Create linkable assets (tools, research, data)");
  drActions.push("Monitor referring domain growth monthly");
  if (data.backlinks.dofollowRatio < 0.6 && data.backlinks.total > 0) {
    drActions.push("Improve dofollow ratio through quality link building");
  }

  // === Competitor Insights ===

  if (data.project.competitors?.length) {
    competitorInsights.push(
      `Competitors tracked: ${data.project.competitors.join(", ")} — run competitor keyword analysis to find content gaps`
    );
  } else {
    competitorInsights.push(
      "No competitors configured — add competitors to enable gap analysis and benchmarking"
    );
  }

  // === Overall Score ===

  const overallScore = calculateOverallScore(data);

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    quickWins,
    contentPlan,
    technicalFixes,
    linkBuilding,
    drPlan: {
      currentDR,
      targetDR,
      actions: drActions,
    },
    competitorInsights,
  };
}

function calculateOverallScore(data: AggregatedData): number {
  let score = 50; // start at midpoint

  // Page health (up to +/- 20 points)
  if (data.pages.total > 0) {
    const missingMetaRatio = data.pages.missingDescription / data.pages.total;
    const missingTitleRatio = data.pages.missingTitle / data.pages.total;
    const thinRatio = data.pages.thinContent / data.pages.total;
    const brokenRatio = data.pages.brokenLinks / data.pages.total;

    score -= Math.round(missingMetaRatio * 10);
    score -= Math.round(missingTitleRatio * 10);
    score -= Math.round(thinRatio * 10);
    score -= Math.round(brokenRatio * 10);

    if (data.pages.avgWordCount > 800) score += 5;
    if (missingMetaRatio === 0 && missingTitleRatio === 0) score += 5;
  } else {
    score -= 15; // no data is bad
  }

  // Domain Rating (up to +/- 15 points)
  const dr = data.domainRating.current ?? 0;
  if (dr >= 40) score += 15;
  else if (dr >= 20) score += 8;
  else if (dr >= 10) score += 3;
  else score -= 5;

  // Keywords (up to +/- 10 points)
  if (data.keywords.total > 0) {
    const top10Ratio = data.keywords.top10Count / data.keywords.total;
    score += Math.round(top10Ratio * 10);
  }

  // GSC (up to +/- 5 points)
  if (data.gsc.totalImpressions > 0) {
    if (data.gsc.avgCtr >= 0.05) score += 5;
    else if (data.gsc.avgCtr >= 0.03) score += 2;
  }

  // Backlinks (up to +/- 5 points)
  if (data.backlinks.uniqueDomains >= 50) score += 5;
  else if (data.backlinks.uniqueDomains >= 20) score += 2;

  return Math.max(0, Math.min(100, score));
}
