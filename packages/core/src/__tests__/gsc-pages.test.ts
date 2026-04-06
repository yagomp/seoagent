import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["page"],
      rowLimit: 10,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["https://example.com/blog/seo"], clicks: 500, impressions: 5000, ctr: 0.1, position: 3.2 },
    { keys: ["https://example.com/"], clicks: 300, impressions: 8000, ctr: 0.0375, position: 8.1 },
    { keys: ["https://example.com/pricing"], clicks: 200, impressions: 2000, ctr: 0.1, position: 2.5 },
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

describe("gscPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pages sorted by clicks (default)", async () => {
    const { gscPages } = await import("../gsc/pages.js");

    const result = await gscPages("my-site");

    expect(result).toHaveLength(3);
    expect(result[0].page).toBe("https://example.com/blog/seo");
    expect(result[0].clicks).toBe(500);
  });

  it("passes limit to rowLimit in query params", async () => {
    const { gscPages } = await import("../gsc/pages.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPages("my-site", { limit: 5 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rowLimit: 5 })
    );
  });

  it("passes days option through", async () => {
    const { gscPages } = await import("../gsc/pages.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPages("my-site", { days: 7 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ days: 7 })
    );
  });

  it("throws when not authenticated", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscPages } = await import("../gsc/pages.js");

    await expect(gscPages("my-site")).rejects.toThrow(/GSC not authenticated/);
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscPages } = await import("../gsc/pages.js");

    await expect(gscPages("nonexistent")).rejects.toThrow(/Project.*not found/);
  });
});
