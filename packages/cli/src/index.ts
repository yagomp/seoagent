#!/usr/bin/env node

import { Command } from "commander";
import { registerProjectCommands } from "./commands/project.js";
import { registerKeywordsCommands } from "./commands/keywords.js";
import { registerAuditCommands } from "./commands/audit.js";
import { registerCompetitorCommands } from "./commands/competitor.js";
import { registerDomainCommands } from "./commands/domain.js";
import { registerStrategyCommands } from "./commands/strategy.js";
import { registerGscCommands } from "./commands/gsc.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerDashboardCommand } from "./commands/dashboard.js";

const program = new Command();

program
  .name("seoagent")
  .description("Agent-first SEO toolkit — audits, keywords, rank tracking, competitors, backlinks, strategy")
  .version("0.1.0")
  .option("--format <format>", "Output format: table, json, markdown", "table");

registerProjectCommands(program);
registerKeywordsCommands(program);
registerAuditCommands(program);
registerCompetitorCommands(program);
registerDomainCommands(program);
registerStrategyCommands(program);
registerGscCommands(program);
registerConfigCommands(program);
registerDashboardCommand(program);

program.parse();
