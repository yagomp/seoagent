import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataForSeoProvider } from "../providers/dataforseo.js";

// Mock undici at module level
vi.mock("undici", () => ({
  request: vi.fn(),
}));

import { request } from "undici";

const mockRequest = vi.mocked(request);

function mockResponse(body: unknown) {
  return {
    statusCode: 200,
    body: {
      json: () => Promise.resolve(body),
    },
  };
}

describe("DataForSeoProvider", () => {
  let provider: DataForSeoProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DataForSeoProvider("test-login", "test-password");
  });

  it("sends correct auth header", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [{ result: [{ items: [] }] }],
      }) as never
    );

    await provider.getKeywordVolume(["test"], "en-US");

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const callArgs = mockRequest.mock.calls[0];
    expect(callArgs[0]).toBe(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"
    );
    const options = callArgs[1] as Record<string, unknown>;
    const headers = options.headers as Record<string, string>;
    const expected = Buffer.from("test-login:test-password").toString("base64");
    expect(headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("getKeywordVolume returns parsed keyword data", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    keyword: "seo tools",
                    search_volume: 12000,
                    keyword_info: {
                      search_volume: 12000,
                    },
                    competition: 0.65,
                    cpc: 3.5,
                    keyword_properties: {
                      keyword_difficulty: 72,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getKeywordVolume(["seo tools"], "en-US");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      keyword: "seo tools",
      volume: 12000,
      difficulty: 72,
      cpc: 3.5,
      competition: 0.65,
    });
  });

  it("getSerpResults returns parsed SERP data", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    type: "organic",
                    rank_absolute: 1,
                    url: "https://example.com/page",
                    title: "Example Page",
                    description: "A description",
                    domain: "example.com",
                  },
                  {
                    type: "paid",
                    rank_absolute: 0,
                    url: "https://ad.com",
                    title: "Ad",
                    description: "Ad desc",
                    domain: "ad.com",
                  },
                  {
                    type: "organic",
                    rank_absolute: 2,
                    url: "https://other.com",
                    title: "Other",
                    description: "Other desc",
                    domain: "other.com",
                  },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getSerpResults("seo tools", "en-US");

    // Should only include organic results
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      position: 1,
      url: "https://example.com/page",
      title: "Example Page",
      description: "A description",
      domain: "example.com",
    });
  });

  it("getKeywordSuggestions returns keyword strings", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  { keyword: "seo tools free" },
                  { keyword: "best seo tools" },
                  { keyword: "seo tools for beginners" },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getKeywordSuggestions("seo tools", "en-US");

    expect(results).toEqual([
      "seo tools free",
      "best seo tools",
      "seo tools for beginners",
    ]);
  });

  it("throws on API error response", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            status_code: 40000,
            status_message: "Invalid API credentials",
            result: null,
          },
        ],
      }) as never
    );

    await expect(
      provider.getKeywordVolume(["test"], "en-US")
    ).rejects.toThrow(/Invalid API credentials/);
  });

  it("throws on HTTP error", async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 401,
      body: {
        json: () => Promise.resolve({ status_message: "Unauthorized" }),
      },
    } as never);

    await expect(
      provider.getKeywordVolume(["test"], "en-US")
    ).rejects.toThrow(/401/);
  });
});
