import { parsePage, extractLinks, resolveUrl } from "./fetcher.js";
import { isAllowed } from "./robots.js";
import type { FetchResult } from "./fetcher.js";
import type { PageData, RobotsRules, LinkData } from "../types.js";

export interface CrawlQueueOptions {
  domain: string;
  seedUrl: string;
  maxPages: number;
  concurrency: number;
  fetchFn: (url: string) => Promise<FetchResult>;
  robotsRules: RobotsRules;
  sitemapUrls?: string[];
}

export interface CrawlResult {
  page: PageData;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
}

export class CrawlQueue {
  private readonly options: CrawlQueueOptions;
  private readonly visited = new Set<string>();
  private readonly queue: string[] = [];
  private readonly results: CrawlResult[] = [];
  private activeCount = 0;

  constructor(options: CrawlQueueOptions) {
    this.options = options;
  }

  async run(): Promise<CrawlResult[]> {
    // Seed with homepage
    this.queue.push(this.options.seedUrl);
    this.visited.add(this.options.seedUrl);

    // Add sitemap URLs as seeds
    if (this.options.sitemapUrls) {
      for (const url of this.options.sitemapUrls) {
        if (this.visited.has(url)) continue;
        if (this.queue.length + this.visited.size >= this.options.maxPages) break;
        try {
          const parsed = new URL(url);
          if (parsed.hostname !== this.options.domain) continue;
          if (!isAllowed(parsed.pathname, this.options.robotsRules)) continue;
          this.visited.add(url);
          this.queue.push(url);
        } catch {
          // Skip invalid URLs
        }
      }
    }

    await this.processQueue();

    return this.results;
  }

  private async processQueue(): Promise<void> {
    // Keep processing until queue is empty and no active fetches
    while (this.queue.length > 0 || this.activeCount > 0) {
      // Launch up to concurrency limit
      const promises: Promise<void>[] = [];

      while (
        this.queue.length > 0 &&
        this.activeCount < this.options.concurrency &&
        this.results.length + this.activeCount < this.options.maxPages
      ) {
        const url = this.queue.shift()!;
        this.activeCount++;
        promises.push(this.processUrl(url));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      } else if (this.activeCount > 0) {
        // Wait a tick for active fetches to complete
        await new Promise((resolve) => setTimeout(resolve, 1));
      } else {
        break;
      }
    }
  }

  private async processUrl(url: string): Promise<void> {
    try {
      const fetchResult = await this.options.fetchFn(url);

      const parsed = parsePage(fetchResult.body, url);
      const { internal, external } = extractLinks(fetchResult.body, url);

      const page: PageData = {
        url,
        statusCode: fetchResult.statusCode,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        h1: parsed.h1,
        wordCount: parsed.wordCount,
        loadTimeMs: fetchResult.loadTimeMs,
        internalLinks: internal,
        externalLinks: external,
        imagesWithoutAlt: parsed.imagesWithoutAlt,
        issues: [],
        redirectChain:
          fetchResult.redirectChain.length > 0
            ? fetchResult.redirectChain
            : undefined,
      };

      this.results.push({
        page,
        internalLinks: internal,
        externalLinks: external,
      });

      // Enqueue discovered internal links
      for (const link of internal) {
        if (this.visited.has(link.href)) continue;
        if (this.results.length + this.activeCount + this.queue.length >= this.options.maxPages) break;

        try {
          const linkUrl = new URL(link.href);
          if (linkUrl.hostname !== this.options.domain) continue;
          if (!isAllowed(linkUrl.pathname, this.options.robotsRules)) continue;

          this.visited.add(link.href);
          this.queue.push(link.href);
        } catch {
          // Skip invalid URLs
        }
      }
    } catch {
      // Network errors -- record as a failed page
      const page: PageData = {
        url,
        statusCode: 0,
        title: null,
        metaDescription: null,
        h1: null,
        wordCount: 0,
        loadTimeMs: 0,
        internalLinks: [],
        externalLinks: [],
        imagesWithoutAlt: 0,
        issues: [
          {
            type: "broken_link",
            message: `Failed to fetch ${url}`,
            severity: "error",
          },
        ],
      };
      this.results.push({
        page,
        internalLinks: [],
        externalLinks: [],
      });
    } finally {
      this.activeCount--;
    }
  }
}
