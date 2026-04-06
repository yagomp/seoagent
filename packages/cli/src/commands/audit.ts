// @ts-nocheck
import { Command } from "commander";
import {
  auditCrawl,
  auditReport,
  auditPage,
  openDatabase,
  closeDatabase,
  getDbPath,
} from "@seoagent/core";
import { formatOutput, formatKeyValue } from "../format.js";
import { withErrorHandler, requireActiveProject, getFormat } from "../helpers.js";

export function registerAuditCommands(program: Command): void {
  const audit = program.command("audit").description("Site audit and crawling");

  audit
    .command("crawl")
    .description("Crawl the site and store results")
    .option("--max-pages <n>", "Maximum pages to crawl", "100")
    .action(
      withErrorHandler(async (opts: Record<string, string>) => {
        const project = requireActiveProject();
        const maxPages = parseInt(opts.maxPages, 10);
        const domain = project.config.domain;
        console.log(`Crawling ${domain} (max ${maxPages} pages)...`);
        const db = openDatabase(getDbPath(project.slug));
        try {
          const result = await auditCrawl(domain, db, { maxPages });
          console.log(`Crawl complete: ${result.pagesCrawled} pages crawled, ${result.issuesFound} issues found in ${(result.timeMs / 1000).toFixed(1)}s.`);
        } finally {
          closeDatabase(db);
        }
      })
    );

  audit
    .command("report")
    .description("Show audit findings grouped by severity")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const db = openDatabase(getDbPath(project.slug));
        try {
          const report = auditReport(db);
          console.log(`Total pages: ${report.totalPages}`);
          console.log(`\nIssues by type:`);
          for (const [type, count] of Object.entries(report.issuesByType)) {
            console.log(`  ${type}: ${count}`);
          }
          if (report.brokenLinks.length > 0) {
            console.log(`\nBroken links: ${report.brokenLinks.length}`);
            const columns = [
              { key: "sourceUrl", label: "Source", width: 40 },
              { key: "targetUrl", label: "Target", width: 40 },
              { key: "statusCode", label: "Status", width: 8 },
            ];
            console.log(formatOutput(report.brokenLinks as unknown as Record<string, unknown>[], columns, format));
          }
          if (report.duplicateTitles.length > 0) {
            console.log(`\nDuplicate titles: ${report.duplicateTitles.length}`);
          }
          if (report.orphanPages.length > 0) {
            console.log(`\nOrphan pages: ${report.orphanPages.length}`);
          }
        } finally {
          closeDatabase(db);
        }
      })
    );

  audit
    .command("page <url>")
    .description("Detailed audit of a single URL")
    .action(
      withErrorHandler(async (url: string, _opts: unknown, cmd: Command) => {
        const format = getFormat(cmd.optsWithGlobals());
        const result = await auditPage(url);
        console.log(formatKeyValue(result as unknown as Record<string, unknown>, format));
      })
    );
}
