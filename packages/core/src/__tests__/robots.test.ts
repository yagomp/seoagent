import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isAllowed } from "../audit/robots.js";

const SAMPLE_ROBOTS = `
User-agent: *
Disallow: /admin/
Disallow: /private
Allow: /admin/public

User-agent: Googlebot
Disallow: /no-google/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap2.xml
`;

const EMPTY_ROBOTS = ``;

const BLOCK_ALL = `
User-agent: *
Disallow: /
`;

describe("parseRobotsTxt", () => {
  it("parses disallow rules for wildcard user-agent", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.disallowed).toContain("/admin/");
    expect(rules.disallowed).toContain("/private");
  });

  it("parses allow rules for wildcard user-agent", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.allowed).toContain("/admin/public");
  });

  it("extracts sitemaps", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.sitemaps).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/sitemap2.xml",
    ]);
  });

  it("returns empty arrays for empty robots.txt", () => {
    const rules = parseRobotsTxt(EMPTY_ROBOTS);
    expect(rules.disallowed).toEqual([]);
    expect(rules.allowed).toEqual([]);
    expect(rules.sitemaps).toEqual([]);
  });
});

describe("isAllowed", () => {
  it("allows URLs not matching any disallow rule", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/about", rules)).toBe(true);
  });

  it("disallows URLs matching a disallow prefix", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/admin/settings", rules)).toBe(false);
  });

  it("allows URLs matching an allow rule even if disallowed", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/admin/public", rules)).toBe(true);
  });

  it("disallows everything when Disallow: /", () => {
    const rules = parseRobotsTxt(BLOCK_ALL);
    expect(isAllowed("/anything", rules)).toBe(false);
  });

  it("allows root path when not explicitly disallowed", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/", rules)).toBe(true);
  });

  it("disallows exact path match", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/private", rules)).toBe(false);
    expect(isAllowed("/private/page", rules)).toBe(false);
  });
});
