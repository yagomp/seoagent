import { describe, it, expect } from "vitest";
import {
  detectPageIssues,
  detectDuplicateTitles,
  detectOrphanPages,
} from "../audit/issues.js";
import type { PageData } from "../types.js";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/page",
    statusCode: 200,
    title: "Page Title",
    metaDescription: "A meta description for the page.",
    h1: "Main Heading",
    wordCount: 500,
    loadTimeMs: 200,
    internalLinks: [],
    externalLinks: [],
    imagesWithoutAlt: 0,
    issues: [],
    ...overrides,
  };
}

describe("detectPageIssues", () => {
  it("returns no issues for a healthy page", () => {
    const page = makePage();
    const issues = detectPageIssues(page);
    expect(issues).toEqual([]);
  });

  it("detects missing title", () => {
    const page = makePage({ title: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "missing_title", severity: "error" })
    );
  });

  it("detects missing meta description", () => {
    const page = makePage({ metaDescription: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "missing_meta_description",
        severity: "warning",
      })
    );
  });

  it("detects missing h1", () => {
    const page = makePage({ h1: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "missing_h1", severity: "warning" })
    );
  });

  it("detects thin content (fewer than 200 words)", () => {
    const page = makePage({ wordCount: 50 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "thin_content", severity: "warning" })
    );
  });

  it("does not flag thin content at 200 words", () => {
    const page = makePage({ wordCount: 200 });
    const issues = detectPageIssues(page);
    expect(issues.find((i) => i.type === "thin_content")).toBeUndefined();
  });

  it("detects images without alt text", () => {
    const page = makePage({ imagesWithoutAlt: 3 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "images_without_alt",
        severity: "warning",
      })
    );
  });

  it("detects broken page (4xx status)", () => {
    const page = makePage({ statusCode: 404 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "broken_link", severity: "error" })
    );
  });

  it("detects broken page (5xx status)", () => {
    const page = makePage({ statusCode: 500 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "broken_link", severity: "error" })
    );
  });

  it("detects redirect chain (more than 1 redirect)", () => {
    const page = makePage({
      redirectChain: [
        "https://example.com/old",
        "https://example.com/older",
      ],
    });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "redirect_chain",
        severity: "warning",
      })
    );
  });

  it("does not flag a single redirect as a chain", () => {
    const page = makePage({
      redirectChain: ["https://example.com/old"],
    });
    const issues = detectPageIssues(page);
    expect(issues.find((i) => i.type === "redirect_chain")).toBeUndefined();
  });
});

describe("detectDuplicateTitles", () => {
  it("returns empty when all titles are unique", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Title A" }),
      makePage({ url: "https://example.com/b", title: "Title B" }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toEqual([]);
  });

  it("detects pages with the same title", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Same Title" }),
      makePage({ url: "https://example.com/b", title: "Same Title" }),
      makePage({ url: "https://example.com/c", title: "Unique" }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].title).toBe("Same Title");
    expect(dupes[0].urls).toContain("https://example.com/a");
    expect(dupes[0].urls).toContain("https://example.com/b");
  });

  it("ignores pages with null titles", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: null }),
      makePage({ url: "https://example.com/b", title: null }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toEqual([]);
  });
});

describe("detectOrphanPages", () => {
  it("identifies pages with no incoming internal links", () => {
    // Page A links to B, but nobody links to A
    const pages = [
      makePage({
        url: "https://example.com/a",
        internalLinks: [{ href: "https://example.com/b", anchor: "B" }],
      }),
      makePage({
        url: "https://example.com/b",
        internalLinks: [],
      }),
    ];
    // A is the seed URL, B has an incoming link from A.
    // If A is the seed, it should not be considered an orphan.
    const orphans = detectOrphanPages(pages, "https://example.com/a");
    expect(orphans).toEqual([]);
  });

  it("detects orphan page that receives no links and is not seed", () => {
    const pages = [
      makePage({
        url: "https://example.com/",
        internalLinks: [{ href: "https://example.com/about", anchor: "About" }],
      }),
      makePage({
        url: "https://example.com/about",
        internalLinks: [],
      }),
      makePage({
        url: "https://example.com/orphan",
        internalLinks: [],
      }),
    ];
    const orphans = detectOrphanPages(pages, "https://example.com/");
    expect(orphans).toContain("https://example.com/orphan");
    expect(orphans).not.toContain("https://example.com/about");
    expect(orphans).not.toContain("https://example.com/");
  });
});
