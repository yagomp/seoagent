// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { resolveProjectOrThrow, withProjectDb } from "../helpers.js";

export function registerDomainTools(server: McpServer): void {
  server.tool(
    "seoagent_domain_reputation",
    "Get domain reputation: DR score, referring domains count, and backlink profile summary",
    {
      domain: z.string().optional().describe("Domain to check (defaults to project domain)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, project }) => {
      const slug = resolveProject(project);
      const { domainReputation, getConfigValue } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        const login = getConfigValue("dataforseo.login") as string;
        const password = getConfigValue("dataforseo.password") as string;
        if (!login || !password) throw new Error("DataForSEO credentials not configured.");
        return domainReputation(domain ?? proj.domain, db, { login, password });
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_domain_reputation_history",
    "Track domain reputation (DR) changes over time",
    {
      days: z.number().optional().describe("Number of days of history (default: 90)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, project }) => {
      const slug = resolveProject(project);
      const { domainReputationHistory } = await import("@seoagent/core");
      const result = await withProjectDb(slug, (_proj, db) => {
        return domainReputationHistory(db, days ? { limit: days } : {});
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_backlink_profile",
    "Get backlink profile: top referring domains, anchor text distribution, dofollow/nofollow ratio",
    {
      domain: z.string().optional().describe("Domain to analyze (defaults to project domain)"),
      limit: z.number().optional().describe("Max referring domains to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, limit, project }) => {
      const slug = resolveProject(project);
      const { backlinkProfile, getConfigValue } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        const login = getConfigValue("dataforseo.login") as string;
        const password = getConfigValue("dataforseo.password") as string;
        if (!login || !password) throw new Error("DataForSEO credentials not configured.");
        const profile = await backlinkProfile(domain ?? proj.domain, db, { login, password });
        if (limit !== undefined) {
          profile.topDomains = profile.topDomains.slice(0, limit);
        }
        return profile;
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_backlink_opportunities",
    "Find sites that link to competitors but not to you — backlink acquisition opportunities",
    {
      competitors: z.array(z.string()).optional().describe("Competitor domains (defaults to project competitors)"),
      limit: z.number().optional().describe("Max opportunities to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitors, limit, project }) => {
      const slug = resolveProject(project);
      const { backlinkOpportunities, getConfigValue } = await import("@seoagent/core");
      const proj = resolveProjectOrThrow(slug);
      const login = getConfigValue("dataforseo.login") as string;
      const password = getConfigValue("dataforseo.password") as string;
      if (!login || !password) throw new Error("DataForSEO credentials not configured.");
      const competitorList = competitors ?? proj.competitors ?? [];
      let result = await backlinkOpportunities(proj.domain, competitorList, { login, password });
      if (limit !== undefined) {
        result = result.slice(0, limit);
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
