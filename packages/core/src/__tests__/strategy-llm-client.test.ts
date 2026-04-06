import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLlm, getLlmConfig } from "../strategy/llm-client.js";
import type { LlmConfig } from "../strategy/types.js";

// Mock the config module
vi.mock("../config.js", () => ({
  getConfigValue: vi.fn(),
}));

// Mock the external SDKs at the module level
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"generatedAt":"2026-04-04T12:00:00Z"}' }],
      }),
    };
    constructor() {}
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"generatedAt":"2026-04-04T12:00:00Z"}' } }],
        }),
      },
    };
    constructor() {}
  },
}));

describe("llm-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLlmConfig", () => {
    it("returns null when no provider configured", async () => {
      const { getConfigValue } = await import("../config.js");
      (getConfigValue as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const config = getLlmConfig();
      expect(config).toBeNull();
    });

    it("returns config when provider is set", async () => {
      const { getConfigValue } = await import("../config.js");
      (getConfigValue as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        const values: Record<string, string> = {
          "llm.provider": "anthropic",
          "llm.apiKey": "sk-ant-xxx",
          "llm.model": "claude-sonnet-4-6",
        };
        return values[key];
      });

      const config = getLlmConfig();
      expect(config).toEqual({
        provider: "anthropic",
        apiKey: "sk-ant-xxx",
        model: "claude-sonnet-4-6",
        baseUrl: undefined,
      });
    });
  });

  describe("callLlm", () => {
    it("calls Anthropic SDK and returns text", async () => {
      const config: LlmConfig = {
        provider: "anthropic",
        apiKey: "sk-ant-xxx",
        model: "claude-sonnet-4-6",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
    });

    it("calls OpenAI SDK and returns text", async () => {
      const config: LlmConfig = {
        provider: "openai",
        apiKey: "sk-xxx",
        model: "gpt-4o",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
    });

    it("calls Ollama via fetch and returns text", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: { content: '{"generatedAt":"2026-04-04T12:00:00Z"}' },
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const config: LlmConfig = {
        provider: "ollama",
        model: "llama3",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/chat",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("throws on unsupported provider", async () => {
      const config = {
        provider: "unknown" as LlmConfig["provider"],
        apiKey: "xxx",
      };

      await expect(callLlm(config, "sys", "usr")).rejects.toThrow(
        "Unsupported LLM provider: unknown"
      );
    });
  });
});
