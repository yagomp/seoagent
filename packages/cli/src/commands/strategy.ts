// @ts-nocheck
import { Command } from "commander";
import {
  openDatabase,
  closeDatabase,
  getDbPath,
  getProject,
} from "@seoagent/core";
import { strategyGenerate } from "@seoagent/core";
import { strategyRefresh } from "@seoagent/core";
import { withErrorHandler, requireActiveProject, getFormat } from "../helpers.js";
import { formatKeyValue } from "../format.js";

export function registerStrategyCommands(program: Command): void {
  const strategy = program.command("strategy").description("SEO strategy generation");

  strategy
    .command("generate")
    .description("Generate a full prioritized SEO strategy")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        console.log(`Generating strategy for ${project.config.domain}...`);
        const db = openDatabase(getDbPath(project.slug));
        try {
          const result = await strategyGenerate(db, project.config);
          console.log(`\nOverall SEO Health Score: ${result.overallScore}/100\n`);

          if (result.quickWins?.length) {
            console.log(`Quick Wins (${result.quickWins.length}):`);
            result.quickWins.forEach((w, i) => {
              console.log(`  ${i + 1}. [${w.impact} impact / ${w.effort} effort] ${w.action}`);
              console.log(`     ${w.reason}`);
            });
            console.log();
          }

          if (result.technicalFixes?.length) {
            console.log(`Technical Fixes (${result.technicalFixes.length}):`);
            result.technicalFixes.forEach((f, i) => {
              console.log(`  ${i + 1}. ${f.action}`);
              console.log(`     ${f.reason}`);
            });
            console.log();
          }

          if (result.contentPlan?.length) {
            console.log(`Content Plan (${result.contentPlan.length}):`);
            result.contentPlan.forEach((c, i) => {
              console.log(`  ${i + 1}. ${c.action}`);
            });
            console.log();
          }

          if (result.linkBuilding?.length) {
            console.log(`Link Building (${result.linkBuilding.length}):`);
            result.linkBuilding.forEach((l, i) => {
              console.log(`  ${i + 1}. ${l.action}`);
            });
            console.log();
          }

          if (result.drPlan) {
            console.log(`DR Plan: ${result.drPlan.currentDR} → ${result.drPlan.targetDR}`);
            result.drPlan.actions.forEach(a => console.log(`  - ${a}`));
            console.log();
          }

          if (result.competitorInsights?.length) {
            console.log("Competitor Insights:");
            result.competitorInsights.forEach(i => console.log(`  - ${i}`));
          }

          if (format === "json") {
            console.log(JSON.stringify(result, null, 2));
          }
        } finally {
          closeDatabase(db);
        }
      })
    );

  strategy
    .command("refresh")
    .description("Re-run strategy and highlight improvements")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        console.log(`Refreshing strategy for ${project.config.domain}...`);
        const db = openDatabase(getDbPath(project.slug));
        try {
          const result = await strategyRefresh(db, project.config);
          console.log(`\nPrevious Score: ${result.diff.previousScore} → Current: ${result.diff.currentScore}`);
          if (result.diff.improvements.length) {
            console.log("\nImprovements:");
            result.diff.improvements.forEach(i => console.log(`  + ${i}`));
          }
          if (result.diff.regressions.length) {
            console.log("\nRegressions:");
            result.diff.regressions.forEach(r => console.log(`  - ${r}`));
          }
        } finally {
          closeDatabase(db);
        }
      })
    );
}
