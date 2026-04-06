import { google } from "googleapis";
import { getConfigValue, setConfigValue } from "../config.js";
import type { GscCredentials } from "./types.js";

export function createOAuth2Client(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob"
  );
}

export function generateAuthUrl(clientId: string, clientSecret: string): string {
  const client = createOAuth2Client(clientId, clientSecret);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

export function saveGscCredentials(refreshToken: string): void {
  setConfigValue("gsc.refreshToken", refreshToken);
}

export function loadGscCredentials(): GscCredentials | null {
  const clientId = getConfigValue("gsc.clientId") as string | undefined;
  const clientSecret = getConfigValue("gsc.clientSecret") as string | undefined;
  const refreshToken = getConfigValue("gsc.refreshToken") as string | undefined;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

export function createAuthenticatedClient() {
  const creds = loadGscCredentials();
  if (!creds) {
    return null;
  }

  const client = createOAuth2Client(creds.clientId, creds.clientSecret);
  client.setCredentials({ refresh_token: creds.refreshToken });
  return google.searchconsole({ version: "v1", auth: client });
}
