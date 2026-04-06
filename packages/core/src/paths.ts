import path from "node:path";
import os from "node:os";

export function getConfigDir(): string {
  return process.env.SEOAGENT_HOME ?? path.join(os.homedir(), ".seoagent");
}

export function getProjectDir(slug: string): string {
  return path.join(getConfigDir(), "projects", slug);
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getDbPath(slug: string): string {
  return path.join(getProjectDir(slug), "seoagent.db");
}
