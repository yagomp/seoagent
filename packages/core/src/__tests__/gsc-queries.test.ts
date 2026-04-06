import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["query"],
      rowLimit: 20,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["best seo tools"], clicks: 300, impressions: 4000, ctr: 0.075, position: 4.1 },
    { keys: ["seo tips 2026"], clicks: 250, impressions: 3000, ctr: 0.083, position: 5.5 },
    { keys: ["how to rank higher"], clicks: 150, impressions: 6000, ctr: 0.025, position: 12.3 },
  ]),
  formatDateForGsc: vi.fn(),
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

describe("gscQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns queries sorted by clicks", async () => {
    const { gscQueries } = await import("../gsc/queries.js");

    const result = await gscQueries("my-site");

    expect(result).toHaveLength(3);
    expect(result[0].query).toBe("best seo tools");
    expect(result[0].clicks).toBe(300);
    expect(result[2].query).toBe("how to rank higher");
  });

  it("passes page filter through", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { page: "/blog" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pageFilter: "/blog" })
    );
  });

  it("passes limit to rowLimit", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { limit: 50 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rowLimit: 50 })
    );
  });

  it("passes days option through", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { days: 14 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ days: 14 })
    );
  });

  it("throws when not authenticated", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscQueries } = await import("../gsc/queries.js");

    await expect(gscQueries("my-site")).rejects.toThrow(/GSC not authenticated/);
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscQueries } = await import("../gsc/queries.js");

    await expect(gscQueries("nonexistent")).rejects.toThrow(/Project.*not found/);
  });
});
