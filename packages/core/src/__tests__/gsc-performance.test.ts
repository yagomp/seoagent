import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["date"],
      rowLimit: 1000,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["2026-03-01"], clicks: 100, impressions: 1000, ctr: 0.1, position: 5.2 },
    { keys: ["2026-03-02"], clicks: 120, impressions: 1100, ctr: 0.109, position: 4.8 },
  ]),
  formatDateForGsc: vi.fn().mockImplementation((d: Date) => d.toISOString().split("T")[0]),
}));

vi.mock("../gsc/auth.js", () => ({
  createAuthenticatedClient: vi.fn().mockReturnValue({}),
  loadGscCredentials: vi.fn().mockReturnValue({
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "token",
  }),
}));

vi.mock("../project.js", () => ({
  getProject: vi.fn().mockReturnValue({
    slug: "my-site",
    config: { domain: "example.com", name: "My Site" },
  }),
}));

describe("gscPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated performance data with date rows", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");

    const result = await gscPerformance("my-site");

    expect(result.startDate).toBe("2026-03-01");
    expect(result.endDate).toBe("2026-03-28");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe("2026-03-01");
    expect(result.rows[0].clicks).toBe(100);
    expect(result.totals.clicks).toBe(220);
    expect(result.totals.impressions).toBe(2100);
  });

  it("passes query filter to buildQueryParams", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPerformance("my-site", { query: "seo tips" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.stringContaining("example.com"),
      expect.objectContaining({ queryFilter: "seo tips" })
    );
  });

  it("passes page filter to buildQueryParams", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPerformance("my-site", { page: "/blog" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.stringContaining("example.com"),
      expect.objectContaining({ pageFilter: "/blog" })
    );
  });

  it("throws when no GSC credentials configured", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscPerformance } = await import("../gsc/performance.js");

    await expect(gscPerformance("my-site")).rejects.toThrow(
      /GSC not authenticated/
    );
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscPerformance } = await import("../gsc/performance.js");

    await expect(gscPerformance("nonexistent")).rejects.toThrow(
      /Project.*not found/
    );
  });
});
