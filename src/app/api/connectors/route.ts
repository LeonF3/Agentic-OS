import { withDb } from "@/lib/route-helpers";
import { listConnectorsForWorkspace } from "@/lib/connectors";
import { getSettings } from "@/lib/modelrouter";
import { readCollection } from "@/lib/store";
import type { Workspace } from "@/lib/schemas";
import { googleClientId, googleOAuthConfigured, googleOAuthNeedsSecret, googleRedirectUri } from "@/lib/google-oauth";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const settings = await getSettings();
    const activeId = workspaceId ?? settings.activeWorkspaceId;
    if (!activeId) {
      return {
        workspace: null,
        connectors: [],
        google: { clientIdSet: false, oauthReady: false, needsSecret: false, redirectUri: googleRedirectUri() },
      };
    }
    const workspaces = await readCollection<Workspace>("workspaces");
    const workspace = workspaces.find((w) => w.id === activeId) ?? null;
    const connectors = await listConnectorsForWorkspace(activeId);
    return {
      workspace,
      connectors,
      google: {
        clientIdSet: Boolean(googleClientId()),
        oauthReady: googleOAuthConfigured(),
        needsSecret: googleOAuthNeedsSecret(),
        redirectUri: googleRedirectUri(),
      },
    };
  });
}
