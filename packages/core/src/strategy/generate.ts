import type Database from "better-sqlite3";
import type { Strategy } from "./types.js";
import { aggregateProjectData } from "./aggregate.js";
import { getLlmConfig, callLlm } from "./llm-client.js";
import { buildStrategyPrompt } from "./prompt.js";
import { parseStrategyResponse } from "./validate.js";
import { generateRuleBasedStrategy } from "./rules.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export async function strategyGenerate(
  db: Database.Database,
  project: ProjectInfo
): Promise<Strategy> {
  const data = aggregateProjectData(db, project);
  let strategy: Strategy;

  const llmConfig = getLlmConfig();

  if (llmConfig) {
    try {
      const { systemPrompt, userPrompt } = buildStrategyPrompt(data);
      const raw = await callLlm(llmConfig, systemPrompt, userPrompt);
      strategy = parseStrategyResponse(raw);
    } catch (error) {
      // Fall back to rule-based if LLM fails
      console.warn(
        `LLM strategy generation failed, using rule-based fallback: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      strategy = generateRuleBasedStrategy(data);
    }
  } else {
    strategy = generateRuleBasedStrategy(data);
  }

  // Store in database
  storeStrategy(db, strategy);

  return strategy;
}

export function storeStrategy(db: Database.Database, strategy: Strategy): void {
  db.prepare(
    "INSERT INTO strategies (strategy, generated_at) VALUES (?, ?)"
  ).run(JSON.stringify(strategy), strategy.generatedAt);
}

export function getLatestStrategy(db: Database.Database): Strategy | null {
  const row = db
    .prepare("SELECT strategy FROM strategies ORDER BY id DESC LIMIT 1")
    .get() as { strategy: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.strategy) as Strategy;
}

export function getAllStrategies(db: Database.Database): Strategy[] {
  const rows = db
    .prepare("SELECT strategy FROM strategies ORDER BY id DESC")
    .all() as { strategy: string }[];

  return rows.map((r) => JSON.parse(r.strategy) as Strategy);
}
