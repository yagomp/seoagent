import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("gsc auth", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-gsc-auth-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("generates an auth URL with correct scopes", async () => {
    const { generateAuthUrl } = await import("../gsc/auth.js");

    const url = generateAuthUrl("test-client-id", "test-client-secret");
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("test-client-id");
    expect(url).toContain("webmasters.readonly");
  });

  it("creates an OAuth2 client with redirect URI", async () => {
    const { createOAuth2Client } = await import("../gsc/auth.js");

    const client = createOAuth2Client("test-id", "test-secret");
    expect(client).toBeDefined();
  });

  it("stores credentials in config after exchange", async () => {
    const { setConfigValue, getConfigValue } = await import("../config.js");
    const { saveGscCredentials, loadGscCredentials } = await import("../gsc/auth.js");

    setConfigValue("gsc.clientId", "my-client-id");
    setConfigValue("gsc.clientSecret", "my-client-secret");

    saveGscCredentials("my-refresh-token");

    expect(getConfigValue("gsc.refreshToken")).toBe("my-refresh-token");

    const creds = loadGscCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.clientId).toBe("my-client-id");
    expect(creds!.clientSecret).toBe("my-client-secret");
    expect(creds!.refreshToken).toBe("my-refresh-token");
  });

  it("returns null when credentials are incomplete", async () => {
    const { loadGscCredentials } = await import("../gsc/auth.js");

    const creds = loadGscCredentials();
    expect(creds).toBeNull();
  });

  it("creates an authenticated client from stored credentials", async () => {
    const { setConfigValue } = await import("../config.js");
    const { saveGscCredentials, createAuthenticatedClient } = await import("../gsc/auth.js");

    setConfigValue("gsc.clientId", "my-client-id");
    setConfigValue("gsc.clientSecret", "my-client-secret");
    saveGscCredentials("my-refresh-token");

    const client = createAuthenticatedClient();
    expect(client).not.toBeNull();
  });

  it("returns null from createAuthenticatedClient when no credentials", async () => {
    const { createAuthenticatedClient } = await import("../gsc/auth.js");

    const client = createAuthenticatedClient();
    expect(client).toBeNull();
  });
});
