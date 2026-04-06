import type { RobotsRules } from "../types.js";

export function parseRobotsTxt(content: string): RobotsRules {
  const lines = content.split("\n").map((l) => l.trim());
  const allowed: string[] = [];
  const disallowed: string[] = [];
  const sitemaps: string[] = [];

  let inWildcardBlock = false;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    const lower = line.toLowerCase();

    // Detect user-agent blocks
    if (lower.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      inWildcardBlock = agent === "*";
      continue;
    }

    // Sitemaps are global (not tied to user-agent)
    if (lower.startsWith("sitemap:")) {
      const url = line.slice("sitemap:".length).trim();
      if (url) sitemaps.push(url);
      continue;
    }

    // Only process rules from the wildcard block
    if (!inWildcardBlock) continue;

    if (lower.startsWith("disallow:")) {
      const path = line.slice("disallow:".length).trim();
      if (path) disallowed.push(path);
    } else if (lower.startsWith("allow:")) {
      const path = line.slice("allow:".length).trim();
      if (path) allowed.push(path);
    }
  }

  return { allowed, disallowed, sitemaps };
}

export function isAllowed(urlPath: string, rules: RobotsRules): boolean {
  // Allow rules take precedence over disallow when path matches both
  // Check most specific match (longer path wins)
  let matchedAllow = "";
  let matchedDisallow = "";

  for (const pattern of rules.allowed) {
    if (urlPath.startsWith(pattern) && pattern.length > matchedAllow.length) {
      matchedAllow = pattern;
    }
  }

  for (const pattern of rules.disallowed) {
    if (urlPath.startsWith(pattern) && pattern.length > matchedDisallow.length) {
      matchedDisallow = pattern;
    }
  }

  // No match at all -- allowed
  if (!matchedDisallow) return true;

  // Allow rule is more specific (longer) -- allowed
  if (matchedAllow && matchedAllow.length >= matchedDisallow.length) return true;

  // Disallowed
  return false;
}
