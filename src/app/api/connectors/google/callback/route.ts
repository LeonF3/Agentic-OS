import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import {
  decodeOAuthState,
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  GOOGLE_SCOPES,
} from "@/lib/google-oauth";
import { saveGoogleToken } from "@/lib/google-tokens";
import { markGoogleConnectorsConnected } from "@/lib/google-connectors";

export async function GET(req: Request) {
  const base = new URL(req.url);
  const error = base.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(error)}`, req.url));
  }

  const code = base.searchParams.get("code");
  const state = base.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/connectors?error=missing-code", req.url));
  }

  try {
    await ensureSeeded();
    const { workspaceId } = decodeOAuthState(state);
    const tokens = await exchangeGoogleCode(code);
    const email = await fetchGoogleUserEmail(tokens.accessToken);
    await saveGoogleToken({
      workspaceId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scope.split(" "),
      email,
    });
    await markGoogleConnectorsConnected(workspaceId, { email });
    return NextResponse.redirect(new URL("/connectors?connected=google", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google connect failed";
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(message)}`, req.url));
  }
}
