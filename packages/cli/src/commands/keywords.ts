// @ts-nocheck
import { Command } from "commander";
import {
  keywordResearch,
  keywordSuggestions,
  rankTrackAdd,
  rankTrackCheck,
  rankTrackReport,
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

export function registerKeywordsCommands(program: Command): void {
  const keywords = program.command("keywords").description("Keyword research and tracking");

  keywords
    .command("research <keywords...>")
    .description("Get volume, difficulty, and related keywords")
    .option("--locale <locale>", "Search locale (e.g. en-US)", "en-US")
    .action(
      withErrorHandler(async (kws: string[], opts: Record<string, string>, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const db = openDatabase(getDbPath(project.slug));
        try {
          const results = await keywordResearch(db, provider, kws, opts.locale);
          const columns = [
            { key: "keyword", label: "Keyword", width: 30 },
            { key: "volume", label: "Volume", width: 10, align: "right" as const },
            { key: "difficulty", label: "Difficulty", width: 12, align: "right" as const },
            { key: "cpc", label: "CPC", width: 8, align: "right" as const },
          ];
          console.log(formatOutput(results as any, columns, format));
        } finally {
          closeDatabase(db);
        }
      })
    );

  keywords
    .command("suggest <seed>")
    .description("Get keyword suggestions from a seed keyword")
    .option("--limit <n>", "Maximum suggestions to return", "20")
    .option("--locale <locale>", "Search locale", "en-US")
    .action(
      withErrorHandler(async (seed: string, opts: Record<string, string>, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const db = openDatabase(getDbPath(project.slug));
        try {
          const suggestions = await keywordSuggestions(db, provider, seed, opts.locale, parseInt(opts.limit, 10));
          const data = suggestions.map((kw: string) => ({ keyword: kw }));
          const columns = [{ key: "keyword", label: "Keyword", width: 50 }];
          console.log(formatOutput(data, columns, format));
        } finally {
          closeDatabase(db);
        }
      })
    );

  const track = keywords.command("track").description("Rank tracking");

  track
    .command("add <keywords...>")
    .description("Add keywords to track")
    .action(
      withErrorHandler(async (kws: string[]) => {
        const project = requireActiveProject();
        const db = openDatabase(getDbPath(project.slug));
        try {
          rankTrackAdd(db, kws, project.config.locale || "en-US");
          console.log(`Added ${kws.length} keyword(s) to tracking.`);
        } finally {
          closeDatabase(db);
        }
      })
    );

  track
    .command("check")
    .description("Run a rank check for all tracked keywords")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const provider = getProvider();
        const db = openDatabase(getDbPath(project.slug));
        try {
          const results = await rankTrackCheck(db, provider, project.config.domain, project.config.locale || "en-US");
          const columns = [
            { key: "keyword", label: "Keyword", width: 30 },
            { key: "position", label: "Position", width: 10, align: "right" as const },
            { key: "url", label: "URL", width: 50 },
          ];
          console.log(formatOutput(results as any, columns, format));
        } finally {
          closeDatabase(db);
        }
      })
    );

  track
    .command("report")
    .description("Summary of rank changes: movers, losers, new, lost")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const db = openDatabase(getDbPath(project.slug));
        try {
          const report = rankTrackReport(db, project.config.locale || "en-US");
          console.log(`Up: ${report.up?.length || 0} | Down: ${report.down?.length || 0} | New: ${report.new?.length || 0} | Lost: ${report.lost?.length || 0}`);
          if (format === "json") {
            console.log(JSON.stringify(report, null, 2));
          }
        } finally {
          closeDatabase(db);
        }
      })
    );
}
