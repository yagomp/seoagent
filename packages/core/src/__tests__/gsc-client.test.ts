import { describe, it, expect, vi } from "vitest";
import { buildQueryParams, formatDateForGsc } from "../gsc/client.js";

describe("gsc client", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    expect(formatDateForGsc(date)).toBe("2026-03-15");
  });

  it("builds query params with default 28-day range", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
    });

    expect(params.siteUrl).toBe("https://example.com");
    expect(params.requestBody.startDate).toBeDefined();
    expect(params.requestBody.endDate).toBeDefined();
    expect(params.requestBody.dimensions).toEqual(["date"]);
    expect(params.requestBody.rowLimit).toBe(1000);
  });

  it("builds query params with custom days", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["query"],
      days: 7,
      rowLimit: 50,
    });

    const start = new Date(params.requestBody.startDate);
    const end = new Date(params.requestBody.endDate);
    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(7);
    expect(params.requestBody.rowLimit).toBe(50);
  });

  it("builds query params with explicit date range", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["page"],
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(params.requestBody.startDate).toBe("2026-01-01");
    expect(params.requestBody.endDate).toBe("2026-01-31");
  });

  it("adds dimension filter groups for query filter", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      queryFilter: "seo tips",
    });

    expect(params.requestBody.dimensionFilterGroups).toBeDefined();
    expect(params.requestBody.dimensionFilterGroups![0].filters![0]).toEqual({
      dimension: "query",
      operator: "contains",
      expression: "seo tips",
    });
  });

  it("adds dimension filter groups for page filter", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      pageFilter: "https://example.com/blog",
    });

    expect(params.requestBody.dimensionFilterGroups![0].filters![0]).toEqual({
      dimension: "page",
      operator: "contains",
      expression: "https://example.com/blog",
    });
  });

  it("combines query and page filters", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      queryFilter: "seo",
      pageFilter: "/blog",
    });

    const filters =
      params.requestBody.dimensionFilterGroups![0].filters!;
    expect(filters).toHaveLength(2);
    expect(filters[0].dimension).toBe("query");
    expect(filters[1].dimension).toBe("page");
  });
});
