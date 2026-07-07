import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { buildGoogleAuthorizeUrl, encodeOAuthState, googleOAuthEnvHint, googleOAuthNeedsSecret } from "@/lib/google-oauth";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.redirect(new URL("/connectors?error=missing-workspace", req.url));
    }
    if (googleOAuthNeedsSecret()) {
      return NextResponse.redirect(
        new URL(`/connectors?error=${encodeURIComponent(googleOAuthEnvHint())}`, req.url)
      );
    }
    const state = encodeOAuthState(workspaceId);
    const authorizeUrl = buildGoogleAuthorizeUrl(state);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth setup failed";
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(message)}`, req.url));
  }
}
