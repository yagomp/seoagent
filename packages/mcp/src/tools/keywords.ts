// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { withProjectDb } from "../helpers.js";

export function registerKeywordTools(server: McpServer): void {
  server.tool(
    "seoagent_keyword_research",
    "Research keywords: get search volumes, difficulty scores, and related keywords for seed terms",
    {
      keywords: z.array(z.string()).describe("Seed keywords to research"),
      locale: z.string().optional().describe("Search locale (e.g., en-US, en-GB). Defaults to project locale."),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keywords, locale, project }) => {
      const slug = resolveProject(project);
      const { keywordResearch, createProvider } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        const provider = createProvider();
        return keywordResearch(db, provider, keywords, locale ?? proj.locale);
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_keyword_suggestions",
    "Expand a seed keyword into keyword ideas: questions, long-tail variations, and related terms",
    {
      seed: z.string().describe("Seed keyword to expand"),
      locale: z.string().optional().describe("Search locale (e.g., en-US, en-GB)"),
      limit: z.number().optional().describe("Max number of suggestions to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ seed, locale, limit, project }) => {
      const slug = resolveProject(project);
      const { keywordSuggestions, createProvider } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        const provider = createProvider();
        return keywordSuggestions(db, provider, seed, locale ?? proj.locale, limit);
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
