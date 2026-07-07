import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import type { OAuthToken } from "./schemas";
import { refreshGoogleAccessToken } from "./google-oauth";

const COLLECTION = "oauth-tokens";

export async function getGoogleToken(workspaceId: string): Promise<OAuthToken | null> {
  const items = await readCollection<OAuthToken>(COLLECTION);
  return items.find((t) => t.workspaceId === workspaceId && t.provider === "google") ?? null;
}

export async function saveGoogleToken(input: {
  workspaceId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  email: string;
}): Promise<OAuthToken> {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  let saved: OAuthToken | null = null;

  await updateCollection<OAuthToken>(COLLECTION, (items) => {
    const idx = items.findIndex((t) => t.workspaceId === input.workspaceId && t.provider === "google");
    const token: OAuthToken = {
      id: idx >= 0 ? items[idx].id : newId("oauth"),
      workspaceId: input.workspaceId,
      provider: "google",
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt,
      scopes: input.scopes,
      email: input.email,
      updatedAt: now,
    };
    if (idx >= 0) items[idx] = token;
    else items.unshift(token);
    saved = token;
    return items;
  });

  if (!saved) throw new Error("Failed to save Google token");
  return saved;
}

export async function deleteGoogleToken(workspaceId: string): Promise<void> {
  await updateCollection<OAuthToken>(COLLECTION, (items) =>
    items.filter((t) => !(t.workspaceId === workspaceId && t.provider === "google"))
  );
}

export async function getGoogleAccessToken(workspaceId: string): Promise<string> {
  const token = await getGoogleToken(workspaceId);
  if (!token) throw new Error("Google is not connected for this workspace");

  const expiresMs = new Date(token.expiresAt).getTime();
  if (Date.now() < expiresMs - 60_000) return token.accessToken;

  const refreshed = await refreshGoogleAccessToken(token.refreshToken);
  const next = await saveGoogleToken({
    workspaceId,
    accessToken: refreshed.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: refreshed.expiresIn,
    scopes: token.scopes,
    email: token.email,
  });
  return next.accessToken;
}
