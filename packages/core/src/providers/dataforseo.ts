import { request } from "undici";
import type { SearchDataProvider, KeywordData, SerpResult } from "../types.js";

const BASE_URL = "https://api.dataforseo.com/v3";

export class DataForSeoProvider implements SearchDataProvider {
  private authHeader: string;

  constructor(login: string, password: string) {
    this.authHeader = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }

  async getKeywordVolume(
    keywords: string[],
    locale: string
  ): Promise<KeywordData[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keywords,
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/keywords_data/google_ads/search_volume/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => ({
      keyword: item.keyword as string,
      volume: (item.search_volume as number) ?? 0,
      difficulty:
        ((item.keyword_properties as Record<string, unknown>)
          ?.keyword_difficulty as number) ?? 0,
      cpc: (item.cpc as number) ?? 0,
      competition: (item.competition as number) ?? 0,
    }));
  }

  async getSerpResults(
    keyword: string,
    locale: string
  ): Promise<SerpResult[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keyword,
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/serp/google/organic/live/regular",
      body
    );

    const items = extractItems(data);
    return items
      .filter((item: Record<string, unknown>) => item.type === "organic")
      .map((item: Record<string, unknown>) => ({
        position: item.rank_absolute as number,
        url: item.url as string,
        title: (item.title as string) ?? "",
        description: (item.description as string) ?? "",
        domain: item.domain as string,
      }));
  }

  async getKeywordSuggestions(
    seed: string,
    locale: string
  ): Promise<string[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keywords: [seed],
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/keywords_data/google_ads/keywords_for_keywords/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => item.keyword as string);
  }

  async getCompetitorKeywords(
    domain: string,
    locale: string
  ): Promise<KeywordData[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        target1: domain,
        language_code: language,
        location_code: countryToLocationCode(country),
        limit: 100,
      },
    ];

    const data = await this.post(
      "/dataforseo_labs/google/domain_intersection/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => ({
      keyword: item.keyword as string,
      volume: (item.search_volume as number) ?? 0,
      difficulty: (item.keyword_difficulty as number) ?? 0,
      cpc: (item.cpc as number) ?? 0,
      competition: (item.competition as number) ?? 0,
    }));
  }

  private async post(
    endpoint: string,
    body: unknown
  ): Promise<unknown> {
    const response = await request(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.statusCode !== 200) {
      throw new Error(
        `DataForSEO API error: HTTP ${response.statusCode}`
      );
    }

    const data = (await response.body.json()) as Record<string, unknown>;
    return data;
  }
}

function extractItems(data: unknown): Record<string, unknown>[] {
  const root = data as Record<string, unknown>;
  const tasks = root.tasks as Record<string, unknown>[];

  if (!tasks || tasks.length === 0) {
    return [];
  }

  const task = tasks[0];

  if (task.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error: ${task.status_message as string}`
    );
  }

  const results = task.result as Record<string, unknown>[];
  if (!results || results.length === 0) {
    return [];
  }

  const items = results[0].items as Record<string, unknown>[];
  return items ?? [];
}

function parseLocale(locale: string): [string, string] {
  const parts = locale.split("-");
  return [parts[0], parts[1] ?? "US"];
}

const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  BR: 2076,
  IN: 2356,
  JP: 2392,
  MX: 2484,
  NL: 2528,
  SE: 2752,
  NO: 2578,
  DK: 2208,
  FI: 2246,
  PT: 2620,
  PL: 2616,
  IE: 2372,
};

function countryToLocationCode(country: string): number {
  return LOCATION_CODES[country.toUpperCase()] ?? 2840;
}
