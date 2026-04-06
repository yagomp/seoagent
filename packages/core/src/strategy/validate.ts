import { z } from "zod";
import type { Strategy } from "./types.js";

const impactEnum = z.enum(["high", "medium", "low"]);
const effortEnum = z.enum(["high", "medium", "low"]);

const actionItemSchema = z.object({
  action: z.string(),
  reason: z.string(),
  impact: impactEnum,
  effort: effortEnum,
  filePath: z.string().optional(),
});

const contentItemSchema = actionItemSchema.extend({
  targetKeyword: z.string(),
  estimatedVolume: z.number().optional(),
  currentPage: z.string().nullable(),
});

const auditFixSchema = actionItemSchema.extend({
  url: z.string(),
  issueType: z.string(),
});

const linkTacticSchema = actionItemSchema.extend({
  targetDomains: z.array(z.string()).optional(),
  anchorStrategy: z.string().optional(),
});

export const strategySchema = z.object({
  generatedAt: z.string(),
  overallScore: z.number().int().min(0).max(100),
  quickWins: z.array(actionItemSchema),
  contentPlan: z.array(contentItemSchema),
  technicalFixes: z.array(auditFixSchema),
  linkBuilding: z.array(linkTacticSchema),
  drPlan: z.object({
    currentDR: z.number(),
    targetDR: z.number(),
    actions: z.array(z.string()),
  }),
  competitorInsights: z.array(z.string()),
});

export function parseStrategyResponse(raw: string): Strategy {
  // Strip markdown code fences if present
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr.slice(0, 200)}`);
  }

  const result = strategySchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Strategy response failed validation: ${errors}`);
  }

  return result.data as Strategy;
}
