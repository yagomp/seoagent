import { getConfigValue } from "../config.js";
import type { LlmConfig } from "./types.js";

export function getLlmConfig(): LlmConfig | null {
  const provider = getConfigValue("llm.provider") as string | undefined;
  if (!provider) return null;

  return {
    provider: provider as LlmConfig["provider"],
    apiKey: getConfigValue("llm.apiKey") as string | undefined,
    model: getConfigValue("llm.model") as string | undefined,
    baseUrl: getConfigValue("llm.baseUrl") as string | undefined,
  };
}

export async function callLlm(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config, systemPrompt, userPrompt);
    case "openai":
      return callOpenAI(config, systemPrompt, userPrompt);
    case "ollama":
      return callOllama(config, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

async function callAnthropic(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model ?? "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block: { type: string }) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic");
  }
  return textBlock.text;
}

async function callOpenAI(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const response = await client.chat.completions.create({
    model: config.model ?? "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No text response from OpenAI");
  }
  return content;
}

async function callOllama(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model ?? "llama3",
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}
