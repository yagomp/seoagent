// @ts-nocheck
import { Command } from "commander";
import {
  generateAuthUrl,
  gscPerformance,
  gscPages,
} from "@seoagent/core";
import { formatOutput } from "../format.js";
import { withErrorHandler, requireActiveProject, getFormat } from "../helpers.js";

export function registerGscCommands(program: Command): void {
  const gsc = program.command("gsc").description("Google Search Console integration");

  gsc
    .command("auth")
    .description("Authenticate with Google Search Console via OAuth2")
    .requiredOption("--client-id <id>", "Google OAuth2 client ID")
    .requiredOption("--client-secret <secret>", "Google OAuth2 client secret")
    .action(
      withErrorHandler(async (opts: Record<string, string>) => {
        const authUrl = generateAuthUrl(opts.clientId, opts.clientSecret);
        console.log("Open this URL to authorize SEOAgent:\n");
        console.log(`  ${authUrl}\n`);
        console.log("Then run: seoagent config set gsc.refreshToken <token>");
      })
    );

  gsc
    .command("performance")
    .description("Clicks, impressions, CTR, and position data")
    .option("--days <n>", "Number of days to look back", "28")
    .action(
      withErrorHandler(async (opts: Record<string, string>, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const days = parseInt(opts.days, 10);
        const results = await gscPerformance(project.slug, { days });

        const columns = [
          { key: "query", label: "Query", width: 35 },
          { key: "clicks", label: "Clicks", width: 8, align: "right" as const },
          { key: "impressions", label: "Impressions", width: 12, align: "right" as const },
          { key: "ctr", label: "CTR", width: 8, align: "right" as const },
          { key: "position", label: "Position", width: 10, align: "right" as const },
        ];

        console.log(formatOutput(results as unknown as Record<string, unknown>[], columns, format));
      })
    );

  gsc
    .command("pages")
    .description("Top performing pages from Search Console")
    .option("--sort <field>", "Sort by: clicks, impressions, ctr, position", "clicks")
    .option("--days <n>", "Number of days to look back", "28")
    .action(
      withErrorHandler(async (opts: Record<string, string>, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const results = await gscPages(project.slug, {
          sort: opts.sort as "clicks" | "impressions" | "ctr" | "position",
          days: parseInt(opts.days, 10),
        });

        const columns = [
          { key: "page", label: "Page", width: 50 },
          { key: "clicks", label: "Clicks", width: 8, align: "right" as const },
          { key: "impressions", label: "Impressions", width: 12, align: "right" as const },
          { key: "ctr", label: "CTR", width: 8, align: "right" as const },
          { key: "position", label: "Position", width: 10, align: "right" as const },
        ];

        console.log(formatOutput(results as unknown as Record<string, unknown>[], columns, format));
      })
    );
}
