export interface ProjectConfig {
  domain: string;
  name: string;
  description?: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export interface GlobalConfig {
  activeProject?: string;
  dataforseo?: {
    login: string;
    password: string;
  };
  llm?: {
    provider: "anthropic" | "openai" | "ollama";
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
  gsc?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  };
}

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc?: number;
  competition?: number;
}

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
}

export interface SearchDataProvider {
  getKeywordVolume(
    keywords: string[],
    locale: string
  ): Promise<KeywordData[]>;
  getSerpResults(keyword: string, locale: string): Promise<SerpResult[]>;
  getKeywordSuggestions(seed: string, locale: string): Promise<string[]>;
  getCompetitorKeywords(
    domain: string,
    locale: string
  ): Promise<KeywordData[]>;
}

// --- Site Audit Types ---

export interface PageData {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  loadTimeMs: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
  imagesWithoutAlt: number;
  issues: PageIssue[];
  redirectChain?: string[];
}

export interface LinkData {
  href: string;
  anchor: string;
}

export type PageIssueType =
  | "missing_title"
  | "missing_meta_description"
  | "missing_h1"
  | "thin_content"
  | "broken_link"
  | "images_without_alt"
  | "redirect_chain"
  | "duplicate_title"
  | "orphan_page";

export interface PageIssue {
  type: PageIssueType;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  userAgent?: string;
}

export interface CrawlStats {
  pagesCrawled: number;
  issuesFound: number;
  timeMs: number;
  brokenLinks: number;
}

export interface AuditReport {
  totalPages: number;
  issuesByType: Record<string, number>;
  pages: AuditReportPage[];
  brokenLinks: AuditBrokenLink[];
  duplicateTitles: AuditDuplicate[];
  orphanPages: string[];
}

export interface AuditReportPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  issues: PageIssue[];
}

export interface AuditBrokenLink {
  sourceUrl: string;
  targetUrl: string;
  statusCode: number;
}

export interface AuditDuplicate {
  title: string;
  urls: string[];
}

export interface RobotsRules {
  allowed: string[];
  disallowed: string[];
  sitemaps: string[];
}
