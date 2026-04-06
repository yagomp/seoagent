import {
  getProject,
  getActiveProject,
  openDatabase,
  closeDatabase,
  getDbPath,
  createProvider,
} from "@seoagent/core";
import type { SearchDataProvider } from "@seoagent/core";

export interface ResolvedProject {
  slug: string;
  domain: string;
  locale: string;
  name: string;
  niche?: string;
  competitors?: string[];
}

export function resolveProjectOrThrow(slug: string | undefined): ResolvedProject {
  const resolvedSlug = slug ?? getActiveProject();
  if (!resolvedSlug) {
    throw new Error(
      "No project specified. Pass a project parameter or set an active project with: seoagent project use <slug>"
    );
  }
  const entry = getProject(resolvedSlug);
  if (!entry) {
    throw new Error(`Project "${resolvedSlug}" not found.`);
  }
  return {
    slug: resolvedSlug,
    domain: entry.config.domain,
    locale: entry.config.locale ?? "en-US",
    name: entry.config.name,
    niche: entry.config.niche,
    competitors: entry.config.competitors,
  };
}

export async function withProjectDb<T>(
  slug: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (project: ResolvedProject, db: any) => T | Promise<T>
): Promise<T> {
  const project = resolveProjectOrThrow(slug);
  const db = openDatabase(getDbPath(project.slug));
  try {
    return await fn(project, db);
  } finally {
    closeDatabase(db);
  }
}

export function getProjectProvider(slug: string | undefined): { project: ResolvedProject; provider: SearchDataProvider } {
  const project = resolveProjectOrThrow(slug);
  const provider = createProvider();
  return { project, provider };
}

