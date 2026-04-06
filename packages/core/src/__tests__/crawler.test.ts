import { describe, it, expect, vi } from "vitest";
import { CrawlQueue } from "../audit/crawler.js";
import type { FetchResult } from "../audit/fetcher.js";
import type { RobotsRules } from "../types.js";

describe("CrawlQueue", () => {
  it("crawls seed URL and discovers links", async () => {
    const pages: string[] = [];

    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      pages.push(url);
      if (url === "https://example.com/") {
        return {
          statusCode: 200,
          body: `<html><head><title>Home</title></head><body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </body></html>`,
          loadTimeMs: 50,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: `<html><head><title>Page</title></head><body><p>Content here.</p></body></html>`,
        loadTimeMs: 30,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 2,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    const results = await queue.run();

    expect(results.length).toBe(3);
    expect(pages).toContain("https://example.com/");
    expect(pages).toContain("https://example.com/about");
    expect(pages).toContain("https://example.com/contact");
  });

  it("respects maxPages limit", async () => {
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      // Every page links to 3 more pages
      const num = parseInt(url.split("/page")[1] || "0", 10);
      return {
        statusCode: 200,
        body: `<html><head><title>Page ${num}</title></head><body>
          <a href="/page${num * 3 + 1}">Link 1</a>
          <a href="/page${num * 3 + 2}">Link 2</a>
          <a href="/page${num * 3 + 3}">Link 3</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/page0",
      maxPages: 5,
      concurrency: 2,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    const results = await queue.run();
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("respects robots.txt disallow rules", async () => {
    const fetched: string[] = [];
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      fetched.push(url);
      return {
        statusCode: 200,
        body: `<html><head><title>Home</title></head><body>
          <a href="/public">Public</a>
          <a href="/admin/secret">Admin</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const rules: RobotsRules = {
      allowed: [],
      disallowed: ["/admin/"],
      sitemaps: [],
    };

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: rules,
    });

    await queue.run();

    expect(fetched).toContain("https://example.com/");
    expect(fetched).toContain("https://example.com/public");
    expect(fetched).not.toContain("https://example.com/admin/secret");
  });

  it("skips external links", async () => {
    const fetched: string[] = [];
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      fetched.push(url);
      return {
        statusCode: 200,
        body: `<html><head><title>Home</title></head><body>
          <a href="/local">Local</a>
          <a href="https://other.com/page">External</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    await queue.run();

    expect(fetched).not.toContain("https://other.com/page");
  });

  it("does not revisit already-crawled URLs", async () => {
    let fetchCount = 0;
    const mockFetch = vi.fn(async (): Promise<FetchResult> => {
      fetchCount++;
      return {
        statusCode: 200,
        body: `<html><head><title>Page</title></head><body>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    await queue.run();

    // Home + About = 2, not infinite loop
    expect(fetchCount).toBe(2);
  });
});
