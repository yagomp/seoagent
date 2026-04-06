export interface ActionItem {
  action: string;
  reason: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  filePath?: string;
}

export interface ContentItem extends ActionItem {
  targetKeyword: string;
  estimatedVolume?: number;
  currentPage: string | null;
}

export interface AuditFix extends ActionItem {
  url: string;
  issueType: string;
}

export interface LinkTactic extends ActionItem {
  targetDomains?: string[];
  anchorStrategy?: string;
}

export interface Strategy {
  generatedAt: string;
  overallScore: number;
  quickWins: ActionItem[];
  contentPlan: ContentItem[];
  technicalFixes: AuditFix[];
  linkBuilding: LinkTactic[];
  drPlan: {
    currentDR: number;
    targetDR: number;
    actions: string[];
  };
  competitorInsights: string[];
}

export interface StrategyDiff {
  previousScore: number;
  currentScore: number;
  improvements: string[];
  regressions: string[];
  newQuickWins: number;
  resolvedQuickWins: number;
}

export interface StrategyRefreshResult {
  strategy: Strategy;
  diff: StrategyDiff;
}

export interface AggregatedData {
  project: {
    domain: string;
    name: string;
    niche?: string;
    competitors?: string[];
    locale?: string;
  };
  keywords: {
    total: number;
    tracked: number;
    avgPosition: number | null;
    top10Count: number;
  };
  pages: {
    total: number;
    missingTitle: number;
    missingDescription: number;
    missingH1: number;
    thinContent: number;
    avgWordCount: number;
    brokenLinks: number;
  };
  backlinks: {
    total: number;
    uniqueDomains: number;
    dofollowRatio: number;
  };
  domainRating: {
    current: number | null;
    previous: number | null;
    trend: "up" | "down" | "stable" | "unknown";
  };
  gsc: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
}

export interface LlmConfig {
  provider: "anthropic" | "openai" | "ollama";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
