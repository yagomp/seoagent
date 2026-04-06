import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscPerformanceOptions, GscPerformanceResult } from "./types.js";

export async function gscPerformance(
  projectSlug: string,
  options: GscPerformanceOptions = {}
): Promise<GscPerformanceResult> {
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

  const params = buildQueryParams(siteUrl, {
    dimensions: ["date"],
    days: options.days,
    startDate: options.startDate,
    endDate: options.endDate,
    queryFilter: options.query,
    pageFilter: options.page,
  });

  const rows = await executeGscQuery(auth, params);

  const mappedRows = rows.map((row) => ({
    date: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  const totals = mappedRows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      ctr: 0, // computed below
      position: 0, // computed below
    }),
    { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  );

  totals.ctr =
    totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

  const positionSum = mappedRows.reduce((sum, r) => sum + r.position, 0);
  totals.position = mappedRows.length > 0 ? positionSum / mappedRows.length : 0;

  return {
    startDate: params.requestBody.startDate,
    endDate: params.requestBody.endDate,
    totals,
    rows: mappedRows,
  };
}
