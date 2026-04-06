import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscQueriesOptions, GscQueryResult } from "./types.js";

export async function gscQueries(
  projectSlug: string,
  options: GscQueriesOptions = {}
): Promise<GscQueryResult[]> {
  const project = getProject(projectSlug);
  if (!project) {
    throw new Error(`Project "${projectSlug}" not found.`);
  }

  const auth = createAuthenticatedClient();
  if (!auth) {
    throw new Error(
      "GSC not authenticated. Run `seoagent gsc auth` to connect your Google account."
    );
  }

  const siteUrl = `sc-domain:${project.config.domain}`;
  const limit = options.limit ?? 20;

  const params = buildQueryParams(siteUrl, {
    dimensions: ["query"],
    days: options.days,
    rowLimit: limit,
    pageFilter: options.page,
  });

  const rows = await executeGscQuery(auth, params);

  const results: GscQueryResult[] = rows.map((row) => ({
    query: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  results.sort((a, b) => b.clicks - a.clicks);

  return results;
}
