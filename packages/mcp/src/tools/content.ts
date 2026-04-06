// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerContentTools(server: McpServer): void {
  server.tool(
    "seoagent_content_gaps",
    "Find keywords that competitors rank for but you do not, sorted by opportunity score",
    {
      competitors: z.array(z.string()).optional().describe("Competitor domains (defaults to project competitors)"),
      limit: z.number().optional().describe("Max gaps to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitors, limit, project }) => {
      const slug = resolveProject(project);
      const { contentGaps } = await import("@seoagent/core");
      const result = await contentGaps({ competitors, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
