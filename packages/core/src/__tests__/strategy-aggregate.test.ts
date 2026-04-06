import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { aggregateProjectData } from "../strategy/aggregate.js";
import type { AggregatedData } from "../strategy/types.js";

describe("aggregateProjectData", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-agg-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns zeroed data for empty database", () => {
    const db = openDatabase(dbPath);
    const project = { domain: "example.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.project.domain).toBe("example.com");
    expect(result.keywords.total).toBe(0);
    expect(result.keywords.tracked).toBe(0);
    expect(result.keywords.avgPosition).toBeNull();
    expect(result.keywords.top10Count).toBe(0);
    expect(result.pages.total).toBe(0);
    expect(result.pages.missingTitle).toBe(0);
    expect(result.pages.missingDescription).toBe(0);
    expect(result.pages.missingH1).toBe(0);
    expect(result.pages.thinContent).toBe(0);
    expect(result.pages.avgWordCount).toBe(0);
    expect(result.pages.brokenLinks).toBe(0);
    expect(result.backlinks.total).toBe(0);
    expect(result.backlinks.uniqueDomains).toBe(0);
    expect(result.backlinks.dofollowRatio).toBe(0);
    expect(result.domainRating.current).toBeNull();
    expect(result.domainRating.trend).toBe("unknown");
    expect(result.gsc.totalClicks).toBe(0);
    expect(result.gsc.totalImpressions).toBe(0);

    closeDatabase(db);
  });

  it("aggregates keyword data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fpl tips", "en-GB", 5000, 45, 8, 1);
    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fantasy football", "en-GB", 20000, 80, 25, 1);
    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fpl ai", "en-GB", 1000, 20, 3, 0);

    const project = { domain: "fplai.app", name: "FPLai" };
    const result = aggregateProjectData(db, project);

    expect(result.keywords.total).toBe(3);
    expect(result.keywords.tracked).toBe(2);
    expect(result.keywords.avgPosition).toBeCloseTo(12);
    expect(result.keywords.top10Count).toBe(2);

    closeDatabase(db);
  });

  it("aggregates crawl page data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/", 200, "Home", "Welcome", "Home", 800);
    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/about", 200, null, null, null, 50);
    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/broken", 404, "Not Found", "Not Found", "404", 10);

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.pages.total).toBe(3);
    expect(result.pages.missingTitle).toBe(1);
    expect(result.pages.missingDescription).toBe(1);
    expect(result.pages.missingH1).toBe(1);
    expect(result.pages.thinContent).toBe(2); // word_count < 300
    expect(result.pages.avgWordCount).toBeCloseTo(286.67, 0);
    expect(result.pages.brokenLinks).toBe(1); // status 404

    closeDatabase(db);
  });

  it("aggregates backlink data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("blog.com", "https://blog.com/post", "https://ex.com/", "example", 1);
    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("blog.com", "https://blog.com/other", "https://ex.com/about", "about", 0);
    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("news.org", "https://news.org/article", "https://ex.com/", "ex", 1);

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.backlinks.total).toBe(3);
    expect(result.backlinks.uniqueDomains).toBe(2);
    expect(result.backlinks.dofollowRatio).toBeCloseTo(0.6667, 2);

    closeDatabase(db);
  });

  it("aggregates domain rating with trend", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(10, 30, "2026-03-01T00:00:00Z");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(15, 45, "2026-04-01T00:00:00Z");

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.domainRating.current).toBe(15);
    expect(result.domainRating.previous).toBe(10);
    expect(result.domainRating.trend).toBe("up");

    closeDatabase(db);
  });

  it("aggregates GSC data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("2026-04-01", "fpl tips", "https://fplai.app/tips", 100, 2000, 0.05, 8.5);
    db.prepare(
      "INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("2026-04-02", "fpl ai", "https://fplai.app/", 200, 3000, 0.0667, 5.2);

    const project = { domain: "fplai.app", name: "FPLai" };
    const result = aggregateProjectData(db, project);

    expect(result.gsc.totalClicks).toBe(300);
    expect(result.gsc.totalImpressions).toBe(5000);
    expect(result.gsc.avgCtr).toBeCloseTo(0.06, 2);
    expect(result.gsc.avgPosition).toBeCloseTo(6.85, 1);

    closeDatabase(db);
  });
});
