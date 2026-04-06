// @ts-nocheck
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";
import { resolveProjectOrThrow, withProjectDb } from "../helpers.js";

export function registerAuditTools(server: McpServer): void {
  server.tool(
    "seoagent_audit_crawl",
    "Crawl a site up to N pages, storing results in the project database for analysis",
    {
      maxPages: z.number().optional().describe("Maximum pages to crawl (default: 100)"),
      startUrl: z.string().optional().describe("URL to start crawling from (defaults to project domain)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ maxPages, startUrl, project }) => {
      const slug = resolveProject(project);
      const { auditCrawl } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (proj, db) => {
        let domain = proj.domain;
        if (startUrl) {
          try {
            domain = new URL(startUrl).hostname;
          } catch {
            // use project domain if startUrl is not a valid URL
          }
        }
        return auditCrawl(domain, db, { maxPages });
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_audit_report",
    "Generate an audit report: broken links, missing titles/descriptions, thin content, duplicate titles, missing alt text, slow pages, redirect chains, orphan pages",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { auditReport } = await import("@seoagent/core");
      const result = await withProjectDb(slug, async (_proj, db) => {
        return auditReport(db);
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_audit_page",
    "Detailed SEO audit of a single URL: meta tags, headings, content quality, performance, structured data",
    {
      url: z.string().describe("URL to audit"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ url }) => {
      const { auditPage } = await import("@seoagent/core");
      const result = await auditPage(url);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
