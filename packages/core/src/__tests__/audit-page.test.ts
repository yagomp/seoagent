import { describe, it, expect, vi } from "vitest";
import { auditPage } from "../audit/audit-page.js";

vi.mock("../audit/fetcher.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../audit/fetcher.js")>();
  return {
    ...original,
    fetchPage: vi.fn(async (url: string) => {
      if (url === "https://example.com/good") {
        return {
          statusCode: 200,
          body: `<html>
            <head>
              <title>Good Page</title>
              <meta name="description" content="A well-optimized page">
            </head>
            <body>
              <h1>Good Page Heading</h1>
              <p>${"word ".repeat(300)}</p>
              <a href="/other">Other page</a>
              <a href="https://ext.com">External</a>
              <img src="photo.jpg" alt="Photo">
            </body>
          </html>`,
          loadTimeMs: 150,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/bad") {
        return {
          statusCode: 200,
          body: `<html>
            <head></head>
            <body>
              <p>Short.</p>
              <img src="no-alt.jpg">
            </body>
          </html>`,
          loadTimeMs: 300,
          redirectChain: ["https://example.com/old-bad"],
        };
      }
      if (url === "https://example.com/broken") {
        return {
          statusCode: 500,
          body: "Internal Server Error",
          loadTimeMs: 50,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: "<html><head><title>Default</title></head><body>OK</body></html>",
        loadTimeMs: 10,
        redirectChain: [],
      };
    }),
  };
});

describe("auditPage", () => {
  it("returns full page data for a healthy page", async () => {
    const result = await auditPage("https://example.com/good");

    expect(result.url).toBe("https://example.com/good");
    expect(result.statusCode).toBe(200);
    expect(result.title).toBe("Good Page");
    expect(result.metaDescription).toBe("A well-optimized page");
    expect(result.h1).toBe("Good Page Heading");
    expect(result.wordCount).toBeGreaterThan(200);
    expect(result.loadTimeMs).toBe(150);
    expect(result.issues).toEqual([]);
  });

  it("detects multiple issues on a bad page", async () => {
    const result = await auditPage("https://example.com/bad");

    const issueTypes = result.issues.map((i) => i.type);
    expect(issueTypes).toContain("missing_title");
    expect(issueTypes).toContain("missing_meta_description");
    expect(issueTypes).toContain("missing_h1");
    expect(issueTypes).toContain("thin_content");
    expect(issueTypes).toContain("images_without_alt");
  });

  it("returns internal and external link counts", async () => {
    const result = await auditPage("https://example.com/good");
    expect(result.internalLinks.length).toBe(1);
    expect(result.externalLinks.length).toBe(1);
  });

  it("detects broken page status", async () => {
    const result = await auditPage("https://example.com/broken");
    const issueTypes = result.issues.map((i) => i.type);
    expect(issueTypes).toContain("broken_link");
  });

  it("reports images without alt", async () => {
    const result = await auditPage("https://example.com/bad");
    expect(result.imagesWithoutAlt).toBe(1);
  });

  it("includes redirect chain when present", async () => {
    const result = await auditPage("https://example.com/bad");
    expect(result.redirectChain).toEqual(["https://example.com/old-bad"]);
  });
});
