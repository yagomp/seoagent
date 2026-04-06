// @ts-nocheck
import { Command } from "commander";
import {
  addProject,
  listProjects,
  setActiveProject,
  getActiveProject,
} from "@seoagent/core";
import { formatOutput } from "../format.js";
import { withErrorHandler, getFormat } from "../helpers.js";

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Manage SEO projects");

  project
    .command("add <slug>")
    .description("Add a new project")
    .requiredOption("--domain <domain>", "Domain to track (e.g. example.com)")
    .option("--niche <niche>", "Site niche (e.g. sports/fantasy-football)")
    .option("--name <name>", "Project display name")
    .option("--locale <locale>", "Default locale (e.g. en-US)")
    .action(
      withErrorHandler(async (slug: string, opts: Record<string, string>) => {
        addProject(slug, {
          domain: opts.domain,
          name: opts.name || slug,
          niche: opts.niche,
          locale: opts.locale,
        });
        // Auto-set as active project
        setActiveProject(slug);
        console.log(`Project "${slug}" added and set as active.`);
      })
    );

  project
    .command("list")
    .description("List all projects")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const format = getFormat(cmd.optsWithGlobals());
        const projects = listProjects();
        const activeSlug = getActiveProject();

        if (projects.length === 0) {
          console.log("No projects yet. Run: seoagent project add <slug> --domain <d>");
          return;
        }

        const data = projects.map((p) => ({
          slug: p.slug,
          domain: p.config.domain,
          niche: p.config.niche ?? "",
          active: p.slug === activeSlug ? "*" : "",
        }));

        const columns = [
          { key: "active", label: "", width: 2 },
          { key: "slug", label: "Slug", width: 20 },
          { key: "domain", label: "Domain", width: 30 },
          { key: "niche", label: "Niche", width: 25 },
        ];

        console.log(formatOutput(data, columns, format));
      })
    );

  project
    .command("use <slug>")
    .description("Set the active project")
    .action(
      withErrorHandler(async (slug: string) => {
        setActiveProject(slug);
        console.log(`Active project set to "${slug}".`);
      })
    );
}
