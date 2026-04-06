// Types
export type {
  ProjectConfig,
  GlobalConfig,
  KeywordData,
  SerpResult,
  SearchDataProvider,
  PageData,
  LinkData,
  PageIssueType,
  PageIssue,
  CrawlOptions,
  CrawlStats,
  AuditReport,
  AuditReportPage,
  AuditBrokenLink,
  AuditDuplicate,
  RobotsRules,
} from "./types.js";

// Paths
export { getConfigDir, getProjectDir, getConfigPath, getDbPath } from "./paths.js";

// Config
export { loadConfig, saveConfig, setConfigValue, getConfigValue } from "./config.js";

// Database
export { openDatabase, closeDatabase } from "./database.js";

// Projects
export type { ProjectEntry } from "./project.js";
export {
  addProject,
  listProjects,
  getProject,
  removeProject,
  setActiveProject,
  getActiveProject,
} from "./project.js";

// GSC
export {
  generateAuthUrl,
  saveGscCredentials,
  loadGscCredentials,
  createAuthenticatedClient,
} from "./gsc/auth.js";
export { gscPerformance } from "./gsc/performance.js";
export { gscPages } from "./gsc/pages.js";
export { gscQueries } from "./gsc/queries.js";
export { syncGscRows, getGscHistory } from "./gsc/sync.js";
export type {
  GscCredentials,
  GscPerformanceOptions,
  GscPerformanceResult,
  GscPagesOptions,
  GscPageResult,
  GscQueriesOptions,
  GscQueryResult,
} from "./gsc/types.js";
export type { GscSyncRow, GscHistoryFilter } from "./gsc/sync.js";

// DataForSEO
export { dataforseoRequest } from "./dataforseo.js";
export type { DataForSEOCredentials, DataForSEOResponse, DataForSEOTask } from "./dataforseo.js";

// Backlinks
export {
  domainReputation,
  domainReputationHistory,
  backlinkProfile,
  backlinkOpportunities,
} from "./backlinks.js";

export type {
  DomainReputationResult,
  DRHistoryEntry,
  DRHistoryOptions,
  BacklinkProfileResult,
  BacklinkOpportunity,
} from "./backlinks.js";

// Audit
export { auditCrawl } from "./audit/audit-crawl.js";
export { auditReport } from "./audit/audit-report.js";
export { auditPage } from "./audit/audit-page.js";
export { parseRobotsTxt, isAllowed } from "./audit/robots.js";
export { parsePage, extractLinks, resolveUrl, fetchPage } from "./audit/fetcher.js";
export type { ParsedPage, FetchResult } from "./audit/fetcher.js";
export type { CrawlQueueOptions, CrawlResult } from "./audit/crawler.js";

// Providers
export { DataForSeoProvider } from "./providers/dataforseo.js";

// SERP Cache
export { getCachedSerp, setCachedSerp, isCacheFresh } from "./serp-cache.js";
export type { CachedSerp } from "./serp-cache.js";

// Keyword Research
export { keywordResearch, keywordSuggestions } from "./keyword-research.js";

// Rank Tracking
export {
  rankTrackAdd,
  rankTrackCheck,
  rankTrackHistory,
  rankTrackReport,
} from "./rank-tracker.js";
export type {
  RankCheckResult,
  PositionHistoryEntry,
  RankMover,
  RankReport,
} from "./rank-tracker.js";

// Competitor Analysis & Content Gaps
export {
  competitorKeywords,
  competitorCompare,
  contentGaps,
  contentGapsForProject,
} from "./competitors.js";
export type {
  ComparedKeyword,
  CompareResult,
  ContentGap,
  ContentGapsResult,
} from "./competitors.js";

// Provider Factory
export { createProvider } from "./provider-factory.js";

// Strategy Engine
export {
  type Strategy,
  type ActionItem,
  type ContentItem,
  type AuditFix,
  type LinkTactic,
  type StrategyDiff,
  type StrategyRefreshResult,
  type AggregatedData,
  type LlmConfig,
  aggregateProjectData,
  getLlmConfig,
  callLlm,
  buildStrategyPrompt,
  strategySchema,
  parseStrategyResponse,
  generateRuleBasedStrategy,
  strategyGenerate,
  storeStrategy,
  getLatestStrategy,
  getAllStrategies,
  strategyRefresh,
} from "./strategy/index.js";
