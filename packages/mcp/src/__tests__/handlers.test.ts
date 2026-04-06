import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

// Mock @seoagent/core
vi.mock("@seoagent/core", () => ({
  listProjects: vi.fn().mockReturnValue([
    { slug: "my-blog", domain: "myblog.com", name: "My Blog" },
    { slug: "fplai", domain: "fplai.app", name: "FPLai" },
  ]),
  addProject: vi.fn().mockReturnValue(undefined),
  setConfigValue: vi.fn().mockReturnValue(undefined),
  getActiveProject: vi.fn().mockReturnValue("test-project"),
  getProject: vi.fn().mockReturnValue({
    slug: "test-project",
    config: { domain: "test.com", name: "Test Project", locale: "en-US" },
  }),
  openDatabase: vi.fn().mockReturnValue({
    prepare: () => ({ run: () => {}, all: () => [] }),
    transaction: (fn: (arg: unknown[]) => unknown) => fn,
    close: () => {},
  }),
  closeDatabase: vi.fn(),
  getDbPath: vi.fn().mockReturnValue("/tmp/test.db"),
  createProvider: vi.fn().mockReturnValue({
    getKeywordVolume: vi.fn().mockResolvedValue([]),
    getKeywordSuggestions: vi.fn().mockResolvedValue([]),
  }),
  keywordResearch: vi.fn().mockResolvedValue([
    { keyword: "fpl tips", volume: 12000, difficulty: 45 },
  ]),
  auditCrawl: vi.fn().mockResolvedValue({
    pagesCrawled: 50,
    issuesFound: 12,
  }),
  auditReport: vi.fn().mockReturnValue({ totalPages: 0, issuesByType: {}, brokenLinks: [], duplicateTitles: [], orphanPages: [] }),
}));

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return client;
}

function parseToolResult(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textContent = result.content.find((c) => c.type === "text");
  return textContent?.text ? JSON.parse(textContent.text) : null;
}

describe("Tool Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seoagent_projects_list returns project list", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "seoagent_projects_list", arguments: {} });
    const data = parseToolResult(result as any);

    expect(data).toEqual([
      { slug: "my-blog", domain: "myblog.com", name: "My Blog" },
      { slug: "fplai", domain: "fplai.app", name: "FPLai" },
    ]);
  });

  it("seoagent_project_add creates a project", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_project_add",
      arguments: { slug: "new-site", domain: "newsite.com" },
    });
    const data = parseToolResult(result as any);

    expect(data).toEqual({ ok: true, slug: "new-site", domain: "newsite.com" });
  });

  it("seoagent_config_set returns ok", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_config_set",
      arguments: { key: "dataforseo.login", value: "my-login" },
    });
    const data = parseToolResult(result as any);

    expect(data).toEqual({ ok: true, key: "dataforseo.login", value: "my-login" });
  });

  it("seoagent_keyword_research returns keyword data", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_keyword_research",
      arguments: { keywords: ["fpl tips"] },
    });
    const data = parseToolResult(result as any) as any;

    expect(Array.isArray(data)).toBe(true);
    expect(data[0].keyword).toBe("fpl tips");
    expect(data[0].volume).toBe(12000);
  });

  it("seoagent_audit_crawl returns crawl summary", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_audit_crawl",
      arguments: { maxPages: 50 },
    });
    const data = parseToolResult(result as any) as any;

    expect(data.pagesCrawled).toBe(50);
    expect(data.issuesFound).toBe(12);
  });
});
