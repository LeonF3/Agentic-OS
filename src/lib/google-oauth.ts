import crypto from "node:crypto";

export const GOOGLE_CONNECTOR_IDS = ["gmail", "google-calendar"] as const;

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export function googleClientId(): string | undefined {
  return (
    process.env.Google_Client_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  );
}

export function googleClientSecret(): string | undefined {
  return (
    process.env.Google_Client_Secret?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

export function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    "http://localhost:3737/api/connectors/google/callback"
  );
}

export function googleOAuthConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

export function googleOAuthNeedsSecret(): boolean {
  return Boolean(googleClientId() && !googleClientSecret());
}

export function googleOAuthEnvHint(): string {
  if (googleOAuthNeedsSecret()) {
    return "Add Google_Client_Secret to .env.local and restart the dev server.";
  }
  return "Add Google_Client_ID and Google_Client_Secret to .env.local and restart the dev server.";
}

export function encodeOAuthState(workspaceId: string): string {
  const payload = JSON.stringify({
    workspaceId,
    n: crypto.randomBytes(8).toString("hex"),
  });
  return Buffer.from(payload).toString("base64url");
}

export function decodeOAuthState(state: string): { workspaceId: string } {
  const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    workspaceId?: string;
  };
  if (!payload.workspaceId) throw new Error("Invalid OAuth state");
  return { workspaceId: payload.workspaceId };
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const clientId = googleClientId();
  if (!clientId || !googleClientSecret()) {
    throw new Error(googleOAuthEnvHint());
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error(googleOAuthEnvHint());

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token exchange failed: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!data.access_token) throw new Error("Google did not return an access token");
  if (!data.refresh_token) {
    throw new Error("Google did not return a refresh token — revoke app access in your Google account and try again.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    scope: data.scope ?? GOOGLE_SCOPES.join(" "),
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error(googleOAuthEnvHint());

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token refresh failed: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google refresh did not return an access token");
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load Google account profile");
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}
