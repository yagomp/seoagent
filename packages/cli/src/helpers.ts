import { getActiveProject, getProject } from "@seoagent/core";
import type { OutputFormat } from "./format.js";

export interface ActiveProject {
  slug: string;
  config: {
    domain: string;
    name: string;
    description?: string;
    niche?: string;
    competitors?: string[];
    locale?: string;
  };
}

/**
 * Gets the active project or throws a user-friendly error.
 */
export function requireActiveProject(): ActiveProject {
  const slug = getActiveProject();
  if (!slug) {
    throw new Error(
      "No active project set. Run: seoagent project use <slug>"
    );
  }

  const project = getProject(slug);
  if (!project) {
    throw new Error(
      `Project "${slug}" not found. Run: seoagent project list`
    );
  }

  return project as ActiveProject;
}

/**
 * Wraps an async command handler with error handling.
 * Catches errors and prints user-friendly messages instead of stack traces.
 */
export function withErrorHandler(
  fn: (...args: unknown[]) => Promise<void>
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  };
}

/**
 * Extracts the --format option from commander's options object.
 */
export function getFormat(opts: { format?: string }): OutputFormat {
  const fmt = opts.format;
  if (fmt === "json" || fmt === "markdown" || fmt === "table") {
    return fmt;
  }
  return "table";
}
