import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { auditReport } from "../audit/audit-report.js";
import type Database from "better-sqlite3";

describe("auditReport", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-report-test-"));
    const dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);

    // Seed crawl data
    const insertPage = db.prepare(`
      INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count, load_time_ms, issues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLink = db.prepare(`
      INSERT INTO crawl_links (source_url, target_url, anchor_text, is_internal, status_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertPage.run(
      "https://example.com/",
      200,
      "Home",
      "Welcome to example",
      "Welcome",
      500,
      100,
      JSON.stringify([])
    );

    insertPage.run(
      "https://example.com/about",
      200,
      "Home",
      null,
      "About",
      300,
      80,
      JSON.stringify([
        { type: "missing_meta_description", message: "Missing meta", severity: "warning" },
        { type: "duplicate_title", message: "Duplicate title", severity: "warning" },
      ])
    );

    insertPage.run(
      "https://example.com/missing",
      404,
      "Not Found",
      null,
      null,
      10,
      20,
      JSON.stringify([
        { type: "broken_link", message: "HTTP 404", severity: "error" },
      ])
    );

    insertLink.run("https://example.com/", "https://example.com/about", "About", 1, null);
    insertLink.run("https://example.com/", "https://example.com/missing", "Missing", 1, null);
    insertLink.run("https://example.com/about", "https://example.com/", "Home", 1, null);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns total page count", () => {
    const report = auditReport(db);
    expect(report.totalPages).toBe(3);
  });

  it("aggregates issues by type", () => {
    const report = auditReport(db);
    expect(report.issuesByType["broken_link"]).toBe(1);
    expect(report.issuesByType["missing_meta_description"]).toBe(1);
    expect(report.issuesByType["duplicate_title"]).toBe(1);
  });

  it("returns all pages with their issues", () => {
    const report = auditReport(db);
    expect(report.pages).toHaveLength(3);
    const aboutPage = report.pages.find((p) => p.url === "https://example.com/about");
    expect(aboutPage).toBeDefined();
    expect(aboutPage!.issues).toHaveLength(2);
  });

  it("identifies broken links with source and target", () => {
    const report = auditReport(db);
    expect(report.brokenLinks).toContainEqual({
      sourceUrl: "https://example.com/",
      targetUrl: "https://example.com/missing",
      statusCode: 404,
    });
  });

  it("identifies duplicate titles", () => {
    const report = auditReport(db);
    expect(report.duplicateTitles).toHaveLength(1);
    expect(report.duplicateTitles[0].title).toBe("Home");
    expect(report.duplicateTitles[0].urls).toContain("https://example.com/");
    expect(report.duplicateTitles[0].urls).toContain("https://example.com/about");
  });

  it("returns empty report when no crawl data exists", () => {
    db.prepare("DELETE FROM crawl_pages").run();
    db.prepare("DELETE FROM crawl_links").run();

    const report = auditReport(db);
    expect(report.totalPages).toBe(0);
    expect(report.pages).toEqual([]);
    expect(report.brokenLinks).toEqual([]);
  });
});
