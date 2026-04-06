// @ts-nocheck
import { Command } from "commander";
import {
  domainReputation,
  domainReputationHistory,
  backlinkProfile,
  backlinkOpportunities,
  openDatabase,
  closeDatabase,
  getDbPath,
  getConfigValue,
} from "@seoagent/core";
import { formatOutput, formatKeyValue } from "../format.js";
import { withErrorHandler, requireActiveProject, getFormat } from "../helpers.js";

function getCredentials() {
  const login = getConfigValue("dataforseo.login") as string;
  const password = getConfigValue("dataforseo.password") as string;
  if (!login || !password) {
    throw new Error("DataForSEO credentials not configured. Run:\n  seoagent config set dataforseo.login YOUR_LOGIN\n  seoagent config set dataforseo.password YOUR_PASSWORD");
  }
  return { login, password };
}

export function registerDomainCommands(program: Command): void {
  const domain = program.command("domain").description("Domain reputation and backlinks");

  domain
    .command("reputation")
    .description("Domain rating, referring domains, backlink summary")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const credentials = getCredentials();
        const db = openDatabase(getDbPath(project.slug));
        try {
          const result = await domainReputation(project.config.domain, db, credentials);
          console.log(formatKeyValue(result as any, format));
        } finally {
          closeDatabase(db);
        }
      })
    );

  domain
    .command("backlinks")
    .description("Top referring domains and anchor text distribution")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const credentials = getCredentials();
        const db = openDatabase(getDbPath(project.slug));
        try {
          const result = await backlinkProfile(project.config.domain, db, credentials);
          console.log(`Referring domains: ${result.referringDomains}`);
          console.log(`Total backlinks: ${result.totalBacklinks}`);
          console.log(`Dofollow ratio: ${(result.dofollowRatio * 100).toFixed(1)}%\n`);
          if (result.topDomains?.length) {
            const columns = [
              { key: "domain", label: "Domain", width: 40 },
              { key: "rating", label: "DR", width: 6 },
              { key: "links", label: "Links", width: 8 },
            ];
            console.log(formatOutput(result.topDomains as any, columns, format));
          }
        } finally {
          closeDatabase(db);
        }
      })
    );

  domain
    .command("opportunities")
    .description("Sites linking to competitors but not to you")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const project = requireActiveProject();
        const format = getFormat(cmd.optsWithGlobals());
        const credentials = getCredentials();
        const competitors = project.config.competitors || [];
        if (!competitors.length) {
          throw new Error("No competitors configured.");
        }
        const result = await backlinkOpportunities(project.config.domain, competitors, credentials);
        const columns = [
          { key: "domain", label: "Domain", width: 40 },
          { key: "domainRating", label: "DR", width: 6 },
          { key: "linksToCompetitors", label: "Competitor Links", width: 18 },
        ];
        console.log(formatOutput(result as any, columns, format));
      })
    );
}
