export interface GscCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GscPerformanceOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  query?: string;
  page?: string;
}

export interface GscPagesOptions {
  days?: number;
  sort?: "clicks" | "impressions" | "ctr" | "position";
  limit?: number;
}

export interface GscQueriesOptions {
  days?: number;
  page?: string;
  limit?: number;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceResult {
  startDate: string;
  endDate: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  rows: {
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}

export interface GscPageResult {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryResult {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
