import { getConfigValue } from "./config.js";
import { DataForSeoProvider } from "./providers/dataforseo.js";
import type { SearchDataProvider } from "./types.js";

export function createProvider(): SearchDataProvider {
  const login = getConfigValue("dataforseo.login") as string | undefined;
  const password = getConfigValue("dataforseo.password") as
    | string
    | undefined;

  if (!login || !password) {
    throw new Error(
      "DataForSEO credentials not configured. Run: seoagent config set dataforseo.login <login> && seoagent config set dataforseo.password <password>"
    );
  }

  return new DataForSeoProvider(login, password);
}
