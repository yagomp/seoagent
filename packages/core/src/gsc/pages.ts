import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscPagesOptions, GscPageResult } from "./types.js";

export async function gscPages(
  projectSlug: string,
  options: GscPagesOptions = {}
): Promise<GscPageResult[]> {
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
  const sort = options.sort ?? "clicks";
  const limit = options.limit ?? 20;

  const params = buildQueryParams(siteUrl, {
    dimensions: ["page"],
    days: options.days,
    rowLimit: limit,
  });

  const rows = await executeGscQuery(auth, params);

  const results: GscPageResult[] = rows.map((row) => ({
    page: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  results.sort((a, b) => {
    if (sort === "position") {
      return a.position - b.position; // lower is better
    }
    return b[sort] - a[sort]; // higher is better for clicks, impressions, ctr
  });

  return results;
}
