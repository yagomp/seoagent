import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createProvider } from "../provider-factory.js";
import { DataForSeoProvider } from "../providers/dataforseo.js";

describe("createProvider", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-factory-test-")
    );
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when no dataforseo credentials configured", () => {
    // Config dir exists but no config.json
    fs.mkdirSync(tmpDir, { recursive: true });
    expect(() => createProvider()).toThrow(/dataforseo.login/);
  });

  it("returns DataForSeoProvider when credentials are set", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        dataforseo: {
          login: "my-login",
          password: "my-pass",
        },
      })
    );

    const provider = createProvider();
    expect(provider).toBeInstanceOf(DataForSeoProvider);
  });
});
