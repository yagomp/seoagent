import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveProject } from "../project-resolver.js";

describe("resolveProject", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns project from explicit parameter", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject("param-project");
    expect(result).toBe("param-project");
  });

  it("falls back to SEOAGENT_PROJECT env var", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject(undefined);
    expect(result).toBe("env-project");
  });

  it("returns undefined when neither is set", () => {
    delete process.env.SEOAGENT_PROJECT;
    const result = resolveProject(undefined);
    expect(result).toBeUndefined();
  });

  it("trims whitespace from parameter", () => {
    const result = resolveProject("  my-project  ");
    expect(result).toBe("my-project");
  });

  it("ignores empty string parameter, falls back to env", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject("");
    expect(result).toBe("env-project");
  });
});
