// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { resolveProjectOrThrow } from "../helpers.js";

export function registerGscTools(server: McpServer): void {
  server.tool(
    "seoagent_gsc_performance",
    "Get Google Search Console performance data: clicks, impressions, CTR, and average position over a date range",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD), overrides days"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, startDate, endDate, project }) => {
      const slug = resolveProject(project);
      const { gscPerformance } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const result = await gscPerformance(proj.slug, { days, startDate, endDate });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_gsc_pages",
    "Get top performing pages from Google Search Console, sorted by clicks or impressions",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      sort: z.enum(["clicks", "impressions", "ctr", "position"]).optional().describe("Sort metric (default: clicks)"),
      limit: z.number().optional().describe("Max pages to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, sort, limit, project }) => {
      const slug = resolveProject(project);
      const { gscPages } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const result = await gscPages(proj.slug, { days, sort, limit });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_gsc_queries",
    "Get top search queries driving traffic from Google Search Console",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      sort: z.enum(["clicks", "impressions", "ctr", "position"]).optional().describe("Sort metric (default: clicks)"),
      limit: z.number().optional().describe("Max queries to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, sort, limit, project }) => {
      const slug = resolveProject(project);
      const { gscQueries } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const result = await gscQueries(proj.slug, { days, sort, limit });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
