// @ts-nocheck
import { Command } from "commander";
import {
  competitorKeywords,
  competitorCompare,
  contentGapsForProject,
  openDatabase,
  closeDatabase,
  getDbPath,
  createProvider,
  getConfigValue,
} from "@seoagent/core";
import { formatOutput } from "../format.js";
import { withErrorHandler, requireActiveProject, getFormat } from "../helpers.js";

function getProvider() {
  const login = getConfigValue("dataforseo.login") as string;
  const password = getConfigValue("dataforseo.password") as string;
  if (!login || !password) {
    throw new Error("DataForSEO credentials not configured. Run:\n  seoagent config set dataforseo.login YOUR_LOGIN\n  seoagent config set dataforseo.password YOUR_PASSWORD");
  }
  return createProvider(login, password);
}

export function registerCompetitorCommands(program: Command): void {
  const competitor = program.command("competitor").description("Competitor analysis");

  competitor
    .command("keywords <domain>")
    .description("Show keywords a competitor ranks for")
    .option("--locale <locale>", "Search locale", "en-US")
    .action(
      withErrorHandler(async (domain: string, opts: Record<string, string>, cmd: Command) => {
        requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const results = await competitorKeywords(provider, domain, opts.locale || "en-US");
        const columns = [
          { key: "keyword", label: "Keyword", width: 30 },
          { key: "volume", label: "Volume", width: 10, align: "right" as const },
          { key: "difficulty", label: "Difficulty", width: 12, align: "right" as const },
        ];
        console.log(formatOutput(results as any, columns, format));
      })
    );

  competitor
    .command("compare <domain>")
    .description("Side-by-side keyword overlap with a competitor")
    .action(
      withErrorHandler(async (domain: string, _opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const result = await competitorCompare(provider, project.config.domain, domain, project.config.locale || "en-US");
        console.log(`Shared keywords: ${result.shared.length}`);
        console.log(`Your only: ${result.yourOnly.length}`);
        console.log(`Competitor only: ${result.competitorOnly.length}\n`);
        if (result.shared.length && format !== "json") {
          console.log("Shared keywords:");
          const columns = [
            { key: "keyword", label: "Keyword", width: 30 },
            { key: "volume", label: "Volume", width: 10, align: "right" as const },
            { key: "difficulty", label: "Difficulty", width: 12, align: "right" as const },
          ];
          console.log(formatOutput(result.shared as any, columns, format));
        }
        if (format === "json") {
          console.log(JSON.stringify(result, null, 2));
        }
      })
    );

  program
    .command("content-gaps")
    .description("Keywords competitors rank for that you don't")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const result = await contentGapsForProject(provider, project.slug);
        console.log(`Found ${result.gaps.length} content gap(s)\n`);
        const columns = [
          { key: "keyword", label: "Keyword", width: 30 },
          { key: "volume", label: "Volume", width: 10, align: "right" as const },
          { key: "difficulty", label: "Difficulty", width: 12, align: "right" as const },
          { key: "opportunity", label: "Opportunity", width: 12, align: "right" as const },
        ];
        console.log(formatOutput(result.gaps as any, columns, format));
      })
    );
}
