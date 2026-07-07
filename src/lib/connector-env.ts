import type { ConnectorCatalogItem } from "./schemas";
import { googleOAuthConfigured } from "./google-oauth";

export function isConnectorConfigured(item: Pick<ConnectorCatalogItem, "authType" | "envKey" | "oauthProvider">): boolean {
  if (item.authType === "api_key") {
    if (!item.envKey) return false;
    return Boolean(process.env[item.envKey]?.trim());
  }
  if (item.authType === "oauth2" && item.oauthProvider === "google") {
    return googleOAuthConfigured();
  }
  return false;
}

export function connectorEnvValue(item: Pick<ConnectorCatalogItem, "envKey">): string | undefined {
  if (!item.envKey) return undefined;
  const v = process.env[item.envKey]?.trim();
  return v || undefined;
}
