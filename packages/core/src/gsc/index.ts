export {
  generateAuthUrl,
  createOAuth2Client,
  saveGscCredentials,
  loadGscCredentials,
  createAuthenticatedClient,
} from "./auth.js";

export {
  formatDateForGsc,
  buildQueryParams,
  executeGscQuery,
} from "./client.js";
export type { QueryParamsInput, QueryParams } from "./client.js";

export { gscPerformance } from "./performance.js";
export { gscPages } from "./pages.js";
export { gscQueries } from "./queries.js";
export { syncGscRows, getGscHistory } from "./sync.js";
export type { GscSyncRow, GscHistoryFilter } from "./sync.js";

export type {
  GscCredentials,
  GscPerformanceOptions,
  GscPerformanceResult,
  GscPagesOptions,
  GscPageResult,
  GscQueriesOptions,
  GscQueryResult,
  GscRow,
} from "./types.js";
