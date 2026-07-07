import { withDb } from "@/lib/route-helpers";
import { listGmailMessages } from "@/lib/gmail";
import { getSettings } from "@/lib/modelrouter";
import { isGoogleConnected } from "@/lib/google-connectors";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? (await getSettings()).activeWorkspaceId;
    if (!workspaceId) return { connected: false, messages: [] };
    const connected = await isGoogleConnected(workspaceId);
    if (!connected) return { connected: false, messages: [] };
    const messages = await listGmailMessages(workspaceId);
    return { connected: true, messages };
  });
}
