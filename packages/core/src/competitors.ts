import type { SearchDataProvider, KeywordData } from "./types.js";
import { getProject } from "./project.js";

export interface ComparedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  yourPosition?: number;
  competitorPosition?: number;
}

export interface CompareResult {
  yourDomain: string;
  competitorDomain: string;
  shared: ComparedKeyword[];
  yourOnly: ComparedKeyword[];
  competitorOnly: ComparedKeyword[];
}

export interface ContentGap {
  keyword: string;
  volume: number;
  difficulty: number;
  opportunity: number;
  competitorDomains: string[];
}

export interface ContentGapsResult {
  domain: string;
  gaps: ContentGap[];
  totalGaps: number;
  analyzedCompetitors: string[];
}

/**
 * Fetch keywords that a competitor domain ranks for.
 */
export async function competitorKeywords(
  provider: SearchDataProvider,
  domain: string,
  locale: string
): Promise<KeywordData[]> {
  return provider.getCompetitorKeywords(domain, locale);
}

/**
 * Side-by-side keyword overlap between your domain and a competitor.
 * Fetches keywords for both domains, then computes set intersections.
 */
export async function competitorCompare(
  provider: SearchDataProvider,
  yourDomain: string,
  competitorDomain: string,
  locale: string
): Promise<CompareResult> {
  const [yourKeywords, theirKeywords] = await Promise.all([
    provider.getCompetitorKeywords(yourDomain, locale),
    provider.getCompetitorKeywords(competitorDomain, locale),
  ]);

  const yourMap = new Map<string, KeywordData>();
  for (const kw of yourKeywords) {
    yourMap.set(kw.keyword, kw);
  }

  const theirMap = new Map<string, KeywordData>();
  for (const kw of theirKeywords) {
    theirMap.set(kw.keyword, kw);
  }

  const shared: ComparedKeyword[] = [];
  const yourOnly: ComparedKeyword[] = [];
  const competitorOnly: ComparedKeyword[] = [];

  for (const [keyword, yourData] of yourMap) {
    const theirData = theirMap.get(keyword);
    if (theirData) {
      shared.push({
        keyword,
        volume: yourData.volume,
        difficulty: yourData.difficulty,
      });
    } else {
      yourOnly.push({
        keyword,
        volume: yourData.volume,
        difficulty: yourData.difficulty,
      });
    }
  }

  for (const [keyword, theirData] of theirMap) {
    if (!yourMap.has(keyword)) {
      competitorOnly.push({
        keyword,
        volume: theirData.volume,
        difficulty: theirData.difficulty,
      });
    }
  }

  return {
    yourDomain,
    competitorDomain,
    shared,
    yourOnly,
    competitorOnly,
  };
}

/**
 * Find keywords that competitors rank for but you don't.
 * Scores each gap by opportunity: volume * (1 - difficulty/100).
 * Returns gaps sorted by opportunity descending.
 */
export async function contentGaps(
  provider: SearchDataProvider,
  yourDomain: string,
  competitors: string[],
  locale: string
): Promise<ContentGapsResult> {
  if (competitors.length === 0) {
    return {
      domain: yourDomain,
      gaps: [],
      totalGaps: 0,
      analyzedCompetitors: [],
    };
  }

  // Fetch your keywords and all competitor keywords in parallel
  const [yourKeywords, ...competitorResults] = await Promise.all([
    provider.getCompetitorKeywords(yourDomain, locale),
    ...competitors.map((c) => provider.getCompetitorKeywords(c, locale)),
  ]);

  // Build a set of your keywords for fast lookup
  const yourKeywordSet = new Set(yourKeywords.map((kw) => kw.keyword));

  // Aggregate competitor keywords: track best volume/difficulty and which competitors have it
  const gapMap = new Map<
    string,
    { volume: number; difficulty: number; domains: string[] }
  >();

  for (let i = 0; i < competitors.length; i++) {
    const competitorDomain = competitors[i];
    const keywords = competitorResults[i];

    for (const kw of keywords) {
      // Skip keywords you already rank for
      if (yourKeywordSet.has(kw.keyword)) continue;

      const existing = gapMap.get(kw.keyword);
      if (existing) {
        existing.domains.push(competitorDomain);
        // Use highest volume and lowest difficulty (best-case data)
        if (kw.volume > existing.volume) {
          existing.volume = kw.volume;
        }
        if (kw.difficulty < existing.difficulty) {
          existing.difficulty = kw.difficulty;
        }
      } else {
        gapMap.set(kw.keyword, {
          volume: kw.volume,
          difficulty: kw.difficulty,
          domains: [competitorDomain],
        });
      }
    }
  }

  // Convert to array and compute opportunity scores
  const gaps: ContentGap[] = [];
  for (const [keyword, data] of gapMap) {
    const opportunity = Math.round(data.volume * (1 - data.difficulty / 100));
    gaps.push({
      keyword,
      volume: data.volume,
      difficulty: data.difficulty,
      opportunity,
      competitorDomains: data.domains,
    });
  }

  // Sort by opportunity descending
  gaps.sort((a, b) => b.opportunity - a.opportunity);

  return {
    domain: yourDomain,
    gaps,
    totalGaps: gaps.length,
    analyzedCompetitors: competitors,
  };
}

/**
 * Project-aware content gap analysis.
 * Reads domain, competitors, and locale from the project config.
 */
export async function contentGapsForProject(
  provider: SearchDataProvider,
  projectSlug: string
): Promise<ContentGapsResult> {
  const project = getProject(projectSlug);
  if (!project) {
    throw new Error(`Project "${projectSlug}" not found`);
  }
  const domain = project.config.domain;
  const competitors = project.config.competitors ?? [];
  const locale = project.config.locale ?? "en-US";

  return contentGaps(provider, domain, competitors, locale);
}
