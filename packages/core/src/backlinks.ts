import type Database from "better-sqlite3";
import {
  dataforseoRequest,
  type DataForSEOCredentials,
} from "./dataforseo.js";

// --- Types ---

export interface DomainReputationResult {
  domain: string;
  domainRating: number;
  totalBacklinks: number;
  referringDomains: number;
  referringDomainsNofollow: number;
  brokenBacklinks: number;
  referringIps: number;
  referringSubnets: number;
}

export interface DRHistoryEntry {
  domainRating: number;
  referringDomains: number;
  checkedAt: string;
}

export interface DRHistoryOptions {
  limit?: number;
}

export interface BacklinkProfileResult {
  referringDomains: number;
  totalBacklinks: number;
  dofollowRatio: number;
  topDomains: { domain: string; rating: number; links: number }[];
  anchorDistribution: { anchor: string; count: number }[];
}

export interface BacklinkOpportunity {
  domain: string;
  domainRating: number;
  linksToCompetitors: number;
}

// --- domainReputation ---

export async function domainReputation(
  domain: string,
  db: Database.Database,
  credentials: DataForSEOCredentials
): Promise<DomainReputationResult> {
  const response = await dataforseoRequest(
    "/backlinks/summary/live",
    [{ target: domain, internal_list_limit: 0 }],
    credentials
  );

  const task = response.tasks[0];
  if (!task.result || task.result.length === 0) {
    throw new Error(`No results returned for domain: ${domain}`);
  }

  const data = task.result[0] as Record<string, unknown>;

  const result: DomainReputationResult = {
    domain,
    domainRating: (data.rank as number) ?? 0,
    totalBacklinks: (data.backlinks as number) ?? 0,
    referringDomains: (data.referring_domains as number) ?? 0,
    referringDomainsNofollow: (data.referring_domains_nofollow as number) ?? 0,
    brokenBacklinks: (data.broken_backlinks as number) ?? 0,
    referringIps: (data.referring_ips as number) ?? 0,
    referringSubnets: (data.referring_subnets as number) ?? 0,
  };

  // Persist to dr_history
  db.prepare(
    "INSERT INTO dr_history (domain_rating, referring_domains) VALUES (?, ?)"
  ).run(result.domainRating, result.referringDomains);

  return result;
}

// --- domainReputationHistory ---

export function domainReputationHistory(
  db: Database.Database,
  options: DRHistoryOptions = {}
): DRHistoryEntry[] {
  const { limit } = options;

  let sql = "SELECT domain_rating, referring_domains, checked_at FROM dr_history ORDER BY checked_at ASC";
  const params: unknown[] = [];

  if (limit !== undefined) {
    sql += " LIMIT ?";
    params.push(limit);
  }

  const rows = db.prepare(sql).all(...params) as {
    domain_rating: number;
    referring_domains: number;
    checked_at: string;
  }[];

  return rows.map((row) => ({
    domainRating: row.domain_rating,
    referringDomains: row.referring_domains,
    checkedAt: row.checked_at,
  }));
}

// --- backlinkProfile ---

export async function backlinkProfile(
  domain: string,
  db: Database.Database,
  credentials: DataForSEOCredentials
): Promise<BacklinkProfileResult> {
  // 1. Get summary for totals
  const summaryResponse = await dataforseoRequest(
    "/backlinks/summary/live",
    [{ target: domain, internal_list_limit: 0 }],
    credentials
  );
  const summaryData = summaryResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;

  const referringDomains = (summaryData.referring_domains as number) ?? 0;
  const referringDomainsNofollow =
    (summaryData.referring_domains_nofollow as number) ?? 0;
  const totalBacklinks = (summaryData.backlinks as number) ?? 0;

  const dofollowRatio =
    referringDomains > 0
      ? (referringDomains - referringDomainsNofollow) / referringDomains
      : 0;

  // 2. Get top referring domains
  const refDomainsResponse = await dataforseoRequest(
    "/backlinks/referring_domains/live",
    [{ target: domain, limit: 1000, order_by: ["rank,desc"] }],
    credentials
  );
  const refDomainsData = refDomainsResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;
  const refDomainItems = ((refDomainsData.items as unknown[]) ?? []) as {
    domain: string;
    rank: number;
    backlinks: number;
  }[];

  const topDomains = refDomainItems.map((item) => ({
    domain: item.domain,
    rating: item.rank ?? 0,
    links: item.backlinks ?? 0,
  }));

  // 3. Get backlinks for anchor distribution + storage
  const backlinksResponse = await dataforseoRequest(
    "/backlinks/backlinks/live",
    [{ target: domain, limit: 1000, order_by: ["rank,desc"] }],
    credentials
  );
  const backlinksData = backlinksResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;
  const backlinkItems = ((backlinksData.items as unknown[]) ?? []) as {
    url_from: string;
    domain_from: string;
    anchor: string;
    is_lost: boolean;
    dofollow: boolean;
    domain_from_rank: number;
  }[];

  // Build anchor distribution
  const anchorCounts = new Map<string, number>();
  for (const item of backlinkItems) {
    const anchor = item.anchor || "";
    if (anchor) {
      anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
    }
  }
  const anchorDistribution = Array.from(anchorCounts.entries())
    .map(([anchor, count]) => ({ anchor, count }))
    .sort((a, b) => b.count - a.count);

  // Store backlinks in database
  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow, domain_rating, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const insertMany = db.transaction((items: typeof backlinkItems) => {
    for (const item of items) {
      insertStmt.run(
        item.domain_from,
        item.url_from,
        domain,
        item.anchor || null,
        item.dofollow ? 1 : 0,
        item.domain_from_rank ?? null
      );
    }
  });
  insertMany(backlinkItems);

  return {
    referringDomains,
    totalBacklinks,
    dofollowRatio,
    topDomains,
    anchorDistribution,
  };
}

// --- backlinkOpportunities ---

export async function backlinkOpportunities(
  domain: string,
  competitors: string[],
  credentials: DataForSEOCredentials
): Promise<BacklinkOpportunity[]> {
  if (competitors.length === 0) {
    throw new Error("Must provide at least one competitor domain");
  }

  // Build targets object: { "1": "competitor1.com", "2": "competitor2.com", ... }
  const targets: Record<string, string> = {};
  competitors.forEach((competitor, index) => {
    targets[String(index + 1)] = competitor;
  });

  const response = await dataforseoRequest(
    "/backlinks/domain_intersection/live",
    [
      {
        targets,
        exclude_targets: [domain],
        limit: 1000,
        order_by: ["rank,desc"],
      },
    ],
    credentials
  );

  const task = response.tasks[0];
  const data = task.result[0] as Record<string, unknown>;
  const items = ((data.items as unknown[]) ?? []) as {
    domain: string;
    rank: number;
    is_intersect: boolean[];
  }[];

  const opportunities: BacklinkOpportunity[] = items.map((item) => {
    const linksToCompetitors = item.is_intersect
      ? item.is_intersect.filter(Boolean).length
      : 1;

    return {
      domain: item.domain,
      domainRating: item.rank ?? 0,
      linksToCompetitors,
    };
  });

  // Sort by domain rating descending
  opportunities.sort((a, b) => b.domainRating - a.domainRating);

  return opportunities;
}
