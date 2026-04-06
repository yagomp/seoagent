import { request } from "undici";

const BASE_URL = "https://api.dataforseo.com/v3";

export interface DataForSEOCredentials {
  login: string;
  password: string;
}

export interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks: DataForSEOTask[];
}

export interface DataForSEOTask {
  id: string;
  status_code: number;
  status_message: string;
  result: Record<string, unknown>[];
}

export async function dataforseoRequest(
  endpoint: string,
  body: Record<string, unknown>[],
  credentials: DataForSEOCredentials
): Promise<DataForSEOResponse> {
  const auth = Buffer.from(
    `${credentials.login}:${credentials.password}`
  ).toString("base64");

  const response = await request(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.statusCode !== 200) {
    const errorBody = await response.body.json().catch(() => ({}));
    throw new Error(
      `DataForSEO API error (HTTP ${response.statusCode}): ${
        (errorBody as Record<string, unknown>).status_message ?? "Unknown error"
      }`
    );
  }

  const data = (await response.body.json()) as DataForSEOResponse;

  if (data.status_code !== 20000) {
    throw new Error(
      `DataForSEO API error (${data.status_code}): ${data.status_message}`
    );
  }

  return data;
}
