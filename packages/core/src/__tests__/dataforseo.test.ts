import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dataforseoRequest } from "../dataforseo.js";

// Mock undici globally
vi.mock("undici", () => ({
  request: vi.fn(),
}));

import { request } from "undici";

describe("dataforseoRequest", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SEOAGENT_HOME: "/tmp/seoagent-test-dfs",
    };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("sends POST with basic auth and returns parsed body", async () => {
    const mockResponse = {
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue({
          status_code: 20000,
          tasks: [{ result: [{ items: [] }] }],
        }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    const result = await dataforseoRequest(
      "/backlinks/summary/live",
      [{ target: "example.com" }],
      { login: "testlogin", password: "testpass" }
    );

    expect(request).toHaveBeenCalledWith(
      "https://api.dataforseo.com/v3/backlinks/summary/live",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
          "Content-Type": "application/json",
        }),
      })
    );

    expect(result.tasks).toBeDefined();
    expect(result.tasks[0].result[0].items).toEqual([]);
  });

  it("throws on non-200 status code", async () => {
    const mockResponse = {
      statusCode: 401,
      body: {
        json: vi.fn().mockResolvedValue({ status_message: "Unauthorized" }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    await expect(
      dataforseoRequest(
        "/backlinks/summary/live",
        [{ target: "example.com" }],
        { login: "testlogin", password: "testpass" }
      )
    ).rejects.toThrow(/DataForSEO API error/);
  });

  it("throws on API-level error status", async () => {
    const mockResponse = {
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue({
          status_code: 40000,
          status_message: "Bad request",
        }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    await expect(
      dataforseoRequest(
        "/backlinks/summary/live",
        [{ target: "example.com" }],
        { login: "testlogin", password: "testpass" }
      )
    ).rejects.toThrow(/Bad request/);
  });
});
