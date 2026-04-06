// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { withProjectDb } from "../helpers.js";

export function registerStrategyTools(server: McpServer): void {
  server.tool(
    "seoagent_strategy_generate",
    "Generate a full prioritized SEO strategy tailored to the domain niche, based on all available data (audit, keywords, competitors, backlinks)",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { strategyGenerate } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        return strategyGenerate(db, {
          domain: proj.domain,
          name: proj.name,
          niche: proj.niche,
          competitors: proj.competitors,
          locale: proj.locale,
        });
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_strategy_refresh",
    "Re-run strategy generation after changes have been made, highlighting improvements and remaining actions",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { strategyRefresh } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        return strategyRefresh(db, {
          domain: proj.domain,
          name: proj.name,
          niche: proj.niche,
          competitors: proj.competitors,
          locale: proj.locale,
        });
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
