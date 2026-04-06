import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

const EXPECTED_TOOLS = [
  // Keyword Research
  "seoagent_keyword_research",
  "seoagent_keyword_suggestions",
  // Rank Tracking
  "seoagent_rank_track_add",
  "seoagent_rank_track_check",
  "seoagent_rank_track_history",
  "seoagent_rank_track_report",
  // Site Audit
  "seoagent_audit_crawl",
  "seoagent_audit_report",
  "seoagent_audit_page",
  // Competitor Analysis
  "seoagent_competitor_keywords",
  "seoagent_competitor_compare",
  // Content Gap
  "seoagent_content_gaps",
  // Domain Reputation
  "seoagent_domain_reputation",
  "seoagent_domain_reputation_history",
  "seoagent_backlink_profile",
  "seoagent_backlink_opportunities",
  // Strategy Engine
  "seoagent_strategy_generate",
  "seoagent_strategy_refresh",
  // Google Search Console
  "seoagent_gsc_performance",
  "seoagent_gsc_pages",
  "seoagent_gsc_queries",
  // Utility
  "seoagent_config_set",
  "seoagent_projects_list",
  "seoagent_project_add",
] as const;

describe("MCP Server", () => {
  it("registers all 24 tools", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();

    expect(tools).toHaveLength(24);

    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  it("each tool has a description", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(10);
    }
  });

  it("each tool has an input schema", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} should have an inputSchema`).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});
