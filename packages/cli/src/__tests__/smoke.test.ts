import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "../index.ts");

function run(args: string): string {
  return execSync(`npx tsx ${CLI_PATH} ${args}`, {
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
}

describe("CLI smoke test", () => {
  it("shows help text", () => {
    const output = run("--help");
    expect(output).toContain("seoagent");
    expect(output).toContain("project");
    expect(output).toContain("keywords");
    expect(output).toContain("audit");
    expect(output).toContain("competitor");
    expect(output).toContain("domain");
    expect(output).toContain("strategy");
    expect(output).toContain("gsc");
    expect(output).toContain("config");
    expect(output).toContain("dashboard");
  });

  it("shows version", () => {
    const output = run("--version");
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("project --help shows subcommands", () => {
    const output = run("project --help");
    expect(output).toContain("add");
    expect(output).toContain("list");
    expect(output).toContain("use");
  });

  it("keywords --help shows subcommands", () => {
    const output = run("keywords --help");
    expect(output).toContain("research");
    expect(output).toContain("suggest");
    expect(output).toContain("track");
  });

  it("audit --help shows subcommands", () => {
    const output = run("audit --help");
    expect(output).toContain("crawl");
    expect(output).toContain("report");
    expect(output).toContain("page");
  });

  it("gsc --help shows subcommands", () => {
    const output = run("gsc --help");
    expect(output).toContain("auth");
    expect(output).toContain("performance");
    expect(output).toContain("pages");
  });
});
