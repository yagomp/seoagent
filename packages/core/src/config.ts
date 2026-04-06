import fs from "node:fs";
import path from "node:path";
import { getConfigPath } from "./paths.js";
import type { GlobalConfig } from "./types.js";

export function loadConfig(): GlobalConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as GlobalConfig;
}

export function saveConfig(config: GlobalConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig() as Record<string, unknown>;
  const parts = key.split(".");

  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  saveConfig(config as GlobalConfig);
}

export function getConfigValue(key: string): unknown {
  const config = loadConfig() as Record<string, unknown>;
  const parts = key.split(".");

  let current: unknown = config;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
