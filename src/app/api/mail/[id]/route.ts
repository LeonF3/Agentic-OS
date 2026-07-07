import { withDb } from "@/lib/route-helpers";
import { getGmailMessage } from "@/lib/gmail";
import { getSettings } from "@/lib/modelrouter";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? (await getSettings()).activeWorkspaceId;
    if (!workspaceId) throw new Error("No workspace selected");
    return getGmailMessage(workspaceId, id);
  });
}
