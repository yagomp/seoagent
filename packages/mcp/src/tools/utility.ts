// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerUtilityTools(server: McpServer): void {
  server.tool(
    "seoagent_config_set",
    "Set an SEOAgent configuration value (e.g., API keys, preferences)",
    {
      key: z.string().describe("Config key in dot notation (e.g., dataforseo.login)"),
      value: z.string().describe("Config value to set"),
    },
    async ({ key, value }) => {
      const { setConfigValue } = await import("@seoagent/core");
      await setConfigValue(key, value);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true, key, value }) }],
      };
    }
  );

  server.tool(
    "seoagent_projects_list",
    "List all tracked SEOAgent projects/domains",
    {},
    async () => {
      const { listProjects } = await import("@seoagent/core");
      const projects = await listProjects();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects) }],
      };
    }
  );

  server.tool(
    "seoagent_project_add",
    "Add a new domain/project to track",
    {
      slug: z.string().describe("URL-friendly project identifier (e.g., my-blog)"),
      domain: z.string().describe("Domain to track (e.g., example.com)"),
      name: z.string().optional().describe("Human-readable project name"),
      niche: z.string().optional().describe("Project niche (e.g., sports/fantasy-football)"),
      locale: z.string().optional().describe("Default locale (e.g., en-US)"),
      competitors: z.array(z.string()).optional().describe("Competitor domains"),
    },
    async ({ slug, domain, name, niche, locale, competitors }) => {
      const { addProject } = await import("@seoagent/core");
      const project = await addProject(slug, {
        domain,
        name: name ?? slug,
        niche,
        locale: locale ?? "en-US",
        competitors,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(project) }],
      };
    }
  );
}
