import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { openDatabase, closeDatabase } from "../database.js";

// Mock dataforseo module
vi.mock("../dataforseo.js", () => ({
  dataforseoRequest: vi.fn(),
}));

import { dataforseoRequest } from "../dataforseo.js";
import {
  domainReputation,
  domainReputationHistory,
  backlinkProfile,
  backlinkOpportunities,
} from "../backlinks.js";

describe("domainReputation", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bl-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns domain reputation data from DataForSEO", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 45,
              broken_backlinks: 12,
              referring_ips: 280,
              referring_subnets: 250,
            },
          ],
        },
      ],
    });

    const result = await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.domain).toBe("example.com");
    expect(result.domainRating).toBe(450);
    expect(result.totalBacklinks).toBe(12500);
    expect(result.referringDomains).toBe(340);
    expect(result.referringDomainsNofollow).toBe(45);
    expect(result.brokenBacklinks).toBe(12);
    expect(result.referringIps).toBe(280);
    expect(result.referringSubnets).toBe(250);
  });

  it("calls DataForSEO /backlinks/summary/live endpoint", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 0,
              broken_backlinks: 0,
              referring_ips: 0,
              referring_subnets: 0,
            },
          ],
        },
      ],
    });

    await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(dataforseoRequest).toHaveBeenCalledWith(
      "/backlinks/summary/live",
      [{ target: "example.com", internal_list_limit: 0 }],
      { login: "test", password: "test" }
    );
  });

  it("inserts a record into dr_history table", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 0,
              broken_backlinks: 0,
              referring_ips: 0,
              referring_subnets: 0,
            },
          ],
        },
      ],
    });

    await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    const rows = db
      .prepare("SELECT * FROM dr_history")
      .all() as { domain_rating: number; referring_domains: number }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].domain_rating).toBe(450);
    expect(rows[0].referring_domains).toBe(340);
  });

  it("throws when DataForSEO returns no results", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [],
        },
      ],
    });

    await expect(
      domainReputation("example.com", db, {
        login: "test",
        password: "test",
      })
    ).rejects.toThrow(/No results/);
  });
});

describe("domainReputationHistory", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-drh-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no history exists", () => {
    const history = domainReputationHistory(db);
    expect(history).toEqual([]);
  });

  it("returns DR history entries in chronological order", () => {
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(30, 100, "2026-01-01 00:00:00");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(35, 120, "2026-02-01 00:00:00");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(38, 150, "2026-03-01 00:00:00");

    const history = domainReputationHistory(db);

    expect(history).toHaveLength(3);
    expect(history[0].domainRating).toBe(30);
    expect(history[0].checkedAt).toBe("2026-01-01 00:00:00");
    expect(history[2].domainRating).toBe(38);
    expect(history[2].referringDomains).toBe(150);
  });

  it("respects optional limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      db.prepare(
        "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
      ).run(30 + i, 100 + i * 10, `2026-0${Math.min(i + 1, 9)}-01 00:00:00`);
    }

    const history = domainReputationHistory(db, { limit: 5 });
    expect(history).toHaveLength(5);
  });
});

describe("backlinkProfile", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bp-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns structured backlink profile from DataForSEO", async () => {
    // Mock /backlinks/summary/live for totals
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 5000,
                  referring_domains: 200,
                  referring_domains_nofollow: 30,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    { domain: "blog.example.com", rank: 85, backlinks: 42 },
                    { domain: "news.site.org", rank: 72, backlinks: 18 },
                  ],
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    {
                      url_from: "https://blog.example.com/post-1",
                      domain_from: "blog.example.com",
                      anchor: "best tool",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 85,
                    },
                    {
                      url_from: "https://blog.example.com/post-2",
                      domain_from: "blog.example.com",
                      anchor: "best tool",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 85,
                    },
                    {
                      url_from: "https://news.site.org/article",
                      domain_from: "news.site.org",
                      anchor: "example.com",
                      is_lost: false,
                      dofollow: false,
                      domain_from_rank: 72,
                    },
                  ],
                },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const result = await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.referringDomains).toBe(200);
    expect(result.totalBacklinks).toBe(5000);
    // dofollowRatio = (200 - 30) / 200 = 0.85
    expect(result.dofollowRatio).toBeCloseTo(0.85);
    expect(result.topDomains).toHaveLength(2);
    expect(result.topDomains[0].domain).toBe("blog.example.com");
    expect(result.topDomains[0].rating).toBe(85);
    expect(result.topDomains[0].links).toBe(42);
    expect(result.anchorDistribution).toHaveLength(2);
    // "best tool" appears twice
    expect(
      result.anchorDistribution.find((a) => a.anchor === "best tool")?.count
    ).toBe(2);
  });

  it("stores backlinks in the backlinks table", async () => {
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 1,
                  referring_domains: 1,
                  referring_domains_nofollow: 0,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    {
                      url_from: "https://blog.example.com/post",
                      domain_from: "blog.example.com",
                      anchor: "click here",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 60,
                    },
                  ],
                },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    const rows = db.prepare("SELECT * FROM backlinks").all() as {
      source_domain: string;
      source_url: string;
      anchor_text: string;
      is_dofollow: number;
      domain_rating: number;
    }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].source_domain).toBe("blog.example.com");
    expect(rows[0].source_url).toBe("https://blog.example.com/post");
    expect(rows[0].anchor_text).toBe("click here");
    expect(rows[0].is_dofollow).toBe(1);
    expect(rows[0].domain_rating).toBe(60);
  });

  it("handles zero referring domains without division error", async () => {
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 0,
                  referring_domains: 0,
                  referring_domains_nofollow: 0,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const result = await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.dofollowRatio).toBe(0);
    expect(result.topDomains).toEqual([]);
    expect(result.anchorDistribution).toEqual([]);
  });
});

describe("backlinkOpportunities", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bo-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns domains linking to competitors but not target", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              items: [
                {
                  domain: "linker-a.com",
                  rank: 65,
                  is_intersect: [true, true, false],
                },
                {
                  domain: "linker-b.com",
                  rank: 48,
                  is_intersect: [true, false, false],
                },
                {
                  domain: "linker-c.com",
                  rank: 72,
                  is_intersect: [false, true, false],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com", "competitor2.com"],
      { login: "test", password: "test" }
    );

    expect(result).toHaveLength(3);
    expect(result[0].domain).toBe("linker-c.com");
    expect(result[0].domainRating).toBe(72);
    // Sorted by domainRating descending
    expect(result[1].domainRating).toBe(65);
    expect(result[2].domainRating).toBe(48);
  });

  it("calls DataForSEO /backlinks/domain_intersection/live", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [{ items: [] }],
        },
      ],
    });

    await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com", "competitor2.com"],
      { login: "test", password: "test" }
    );

    expect(dataforseoRequest).toHaveBeenCalledWith(
      "/backlinks/domain_intersection/live",
      [
        {
          targets: {
            1: "competitor1.com",
            2: "competitor2.com",
          },
          exclude_targets: ["mysite.com"],
          limit: 1000,
          order_by: ["rank,desc"],
        },
      ],
      { login: "test", password: "test" }
    );
  });

  it("returns empty array when no opportunities found", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [{ items: [] }],
        },
      ],
    });

    const result = await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com"],
      { login: "test", password: "test" }
    );

    expect(result).toEqual([]);
  });

  it("throws when no competitors provided", async () => {
    await expect(
      backlinkOpportunities("mysite.com", [], {
        login: "test",
        password: "test",
      })
    ).rejects.toThrow(/at least one competitor/);
  });
});
