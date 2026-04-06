import { describe, it, expect, afterEach, vi } from "vitest";
import { getConfigDir, getProjectDir, getConfigPath, getDbPath } from "../paths.js";

describe("paths", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns default config dir under home", () => {
    const dir = getConfigDir();
    expect(dir).toMatch(/\.seoagent$/);
  });

  it("respects SEOAGENT_HOME env var", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const dir = getConfigDir();
    expect(dir).toBe("/tmp/test-seoagent");
  });

  it("returns project dir under config dir", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const dir = getProjectDir("my-site");
    expect(dir).toBe("/tmp/test-seoagent/projects/my-site");
  });

  it("returns config.json path", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const p = getConfigPath();
    expect(p).toBe("/tmp/test-seoagent/config.json");
  });

  it("returns database path for a project", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const p = getDbPath("my-site");
    expect(p).toBe("/tmp/test-seoagent/projects/my-site/seoagent.db");
  });
});
