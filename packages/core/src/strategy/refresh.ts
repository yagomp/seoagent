import type Database from "better-sqlite3";
import type { Strategy, StrategyDiff, StrategyRefreshResult } from "./types.js";
import { strategyGenerate, getLatestStrategy } from "./generate.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export async function strategyRefresh(
  db: Database.Database,
  project: ProjectInfo
): Promise<StrategyRefreshResult> {
  const previous = getLatestStrategy(db);
  const strategy = await strategyGenerate(db, project);
  const diff = diffStrategies(previous, strategy);

  return { strategy, diff };
}

function diffStrategies(
  previous: Strategy | null,
  current: Strategy
): StrategyDiff {
  if (!previous) {
    return {
      previousScore: 0,
      currentScore: current.overallScore,
      improvements: [],
      regressions: [],
      newQuickWins: current.quickWins.length,
      resolvedQuickWins: 0,
    };
  }

  const improvements: string[] = [];
  const regressions: string[] = [];

  // Score change
  const scoreDelta = current.overallScore - previous.overallScore;
  if (scoreDelta > 0) {
    improvements.push(
      `Overall SEO score improved from ${previous.overallScore} to ${current.overallScore} (+${scoreDelta})`
    );
  } else if (scoreDelta < 0) {
    regressions.push(
      `Overall SEO score dropped from ${previous.overallScore} to ${current.overallScore} (${scoreDelta})`
    );
  }

  // DR change
  if (current.drPlan.currentDR > previous.drPlan.currentDR) {
    improvements.push(
      `Domain Rating improved from ${previous.drPlan.currentDR} to ${current.drPlan.currentDR}`
    );
  } else if (current.drPlan.currentDR < previous.drPlan.currentDR) {
    regressions.push(
      `Domain Rating dropped from ${previous.drPlan.currentDR} to ${current.drPlan.currentDR}`
    );
  }

  // Quick wins resolved: actions in previous but not in current
  const previousActions = new Set(previous.quickWins.map((w) => w.action));
  const currentActions = new Set(current.quickWins.map((w) => w.action));

  const resolvedActions = [...previousActions].filter((a) => !currentActions.has(a));
  const newActions = [...currentActions].filter((a) => !previousActions.has(a));

  if (resolvedActions.length > 0) {
    improvements.push(
      `Resolved ${resolvedActions.length} quick win(s) from previous strategy`
    );
  }

  if (newActions.length > 0 && previous.quickWins.length > 0) {
    // Only flag as regression if there were already items and new ones appeared
    // This might just mean new issues were discovered, not necessarily regression
  }

  // Technical fixes resolved
  const prevFixCount = previous.technicalFixes.length;
  const currFixCount = current.technicalFixes.length;
  if (currFixCount < prevFixCount) {
    improvements.push(
      `Technical issues reduced from ${prevFixCount} to ${currFixCount}`
    );
  } else if (currFixCount > prevFixCount) {
    regressions.push(
      `Technical issues increased from ${prevFixCount} to ${currFixCount}`
    );
  }

  return {
    previousScore: previous.overallScore,
    currentScore: current.overallScore,
    improvements,
    regressions,
    newQuickWins: newActions.length,
    resolvedQuickWins: resolvedActions.length,
  };
}
