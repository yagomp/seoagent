// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerRankTrackingTools(server: McpServer): void {
  server.tool(
    "seoagent_rank_track_add",
    "Add keywords to track for a domain. Positions will be checked periodically.",
    {
      keywords: z.array(z.string()).describe("Keywords to start tracking"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keywords, project }) => {
      const slug = resolveProject(project);
      const { rankTrackAdd } = await import("@seoagent/core");
      const result = await rankTrackAdd({ keywords, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_check",
    "Run a rank check now: fetch current SERP positions for all tracked keywords",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { rankTrackCheck } = await import("@seoagent/core");
      const result = await rankTrackCheck({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_history",
    "Get position history for tracked keywords over time",
    {
      keyword: z.string().optional().describe("Filter to a specific keyword"),
      days: z.number().optional().describe("Number of days of history (default: 30)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keyword, days, project }) => {
      const slug = resolveProject(project);
      const { rankTrackHistory } = await import("@seoagent/core");
      const result = await rankTrackHistory({ keyword, days, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_report",
    "Summary report of rank movers: keywords that went up, down, entered, or left the SERPs since last check",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { rankTrackReport } = await import("@seoagent/core");
      const result = await rankTrackReport({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
