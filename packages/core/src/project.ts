import fs from "node:fs";
import path from "node:path";
import { getConfigDir, getProjectDir } from "./paths.js";
import { loadConfig, saveConfig } from "./config.js";
import type { ProjectConfig } from "./types.js";

export interface ProjectEntry {
  slug: string;
  config: ProjectConfig;
}

export function addProject(slug: string, config: ProjectConfig): void {
  const dir = getProjectDir(slug);

  if (fs.existsSync(dir)) {
    throw new Error(`Project "${slug}" already exists`);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify(config, null, 2) + "\n"
  );
}

export function listProjects(): ProjectEntry[] {
  const projectsDir = path.join(getConfigDir(), "projects");
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const projects: ProjectEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(projectsDir, entry.name, "project.json");
    if (!fs.existsSync(configPath)) continue;

    const raw = fs.readFileSync(configPath, "utf-8");
    projects.push({
      slug: entry.name,
      config: JSON.parse(raw) as ProjectConfig,
    });
  }

  return projects;
}

export function getProject(slug: string): ProjectEntry | null {
  const dir = getProjectDir(slug);
  const configPath = path.join(dir, "project.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  return {
    slug,
    config: JSON.parse(raw) as ProjectConfig,
  };
}

export function removeProject(slug: string): void {
  const dir = getProjectDir(slug);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const config = loadConfig();
  if (config.activeProject === slug) {
    config.activeProject = undefined;
    saveConfig(config);
  }
}

export function setActiveProject(slug: string): void {
  const project = getProject(slug);
  if (!project) {
    throw new Error(`Project "${slug}" not found`);
  }

  const config = loadConfig();
  config.activeProject = slug;
  saveConfig(config);
}

export function getActiveProject(): string | undefined {
  const config = loadConfig();
  return config.activeProject;
}
