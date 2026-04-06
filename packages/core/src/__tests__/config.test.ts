import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, saveConfig, setConfigValue, getConfigValue } from "../config.js";

describe("config", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-test-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config when no file exists", () => {
    const config = loadConfig();
    expect(config).toEqual({});
  });

  it("saves and loads config", () => {
    saveConfig({ activeProject: "my-site" });
    const config = loadConfig();
    expect(config.activeProject).toBe("my-site");
  });

  it("sets a nested config value with dot notation", () => {
    setConfigValue("dataforseo.login", "my-login");
    const config = loadConfig();
    expect(config.dataforseo?.login).toBe("my-login");
  });

  it("sets multiple nested values without overwriting siblings", () => {
    setConfigValue("dataforseo.login", "my-login");
    setConfigValue("dataforseo.password", "my-pass");
    const config = loadConfig();
    expect(config.dataforseo?.login).toBe("my-login");
    expect(config.dataforseo?.password).toBe("my-pass");
  });

  it("gets a nested config value with dot notation", () => {
    setConfigValue("llm.provider", "anthropic");
    const value = getConfigValue("llm.provider");
    expect(value).toBe("anthropic");
  });

  it("returns undefined for missing keys", () => {
    const value = getConfigValue("llm.apiKey");
    expect(value).toBeUndefined();
  });
});
