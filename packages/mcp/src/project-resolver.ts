/**
 * Resolve the active project slug.
 * Priority: explicit tool parameter > SEOAGENT_PROJECT env var > undefined
 */
export function resolveProject(paramProject?: string): string | undefined {
  const trimmed = paramProject?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  const envProject = process.env.SEOAGENT_PROJECT?.trim();
  if (envProject && envProject.length > 0) {
    return envProject;
  }

  return undefined;
}
