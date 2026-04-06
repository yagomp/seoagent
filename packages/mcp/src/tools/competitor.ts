// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { resolveProjectOrThrow } from "../helpers.js";

export function registerCompetitorTools(server: McpServer): void {
  server.tool(
    "seoagent_competitor_keywords",
    "Get keywords that a competitor domain ranks for, with volumes and positions",
    {
      domain: z.string().describe("Competitor domain to analyze (e.g., competitor.com)"),
      locale: z.string().optional().describe("Search locale (e.g., en-US)"),
      limit: z.number().optional().describe("Max keywords to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, locale, limit, project }) => {
      const slug = resolveProject(project);
      const { competitorKeywords, createProvider } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const provider = createProvider();
      let result = await competitorKeywords(provider, domain, locale ?? proj.locale);
      if (limit !== undefined) {
        result = result.slice(0, limit);
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_competitor_compare",
    "Side-by-side keyword overlap comparison between your domain and a competitor",
    {
      competitor: z.string().describe("Competitor domain to compare against"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitor, project }) => {
      const slug = resolveProject(project);
      const { competitorCompare, createProvider } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const provider = createProvider();
      const result = await competitorCompare(provider, proj.domain, competitor, proj.locale);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
