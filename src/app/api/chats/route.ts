import { withDb, parseBody } from "@/lib/route-helpers";
import { ChatCreateInput } from "@/lib/schemas";
import { listChatSessions, createChatSession } from "@/lib/chats";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
    return listChatSessions(workspaceId, limit);
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const body = await parseBody(req, ChatCreateInput);
    return createChatSession({
      agentId: body.agentId,
      workspaceId: body.workspaceId,
      input: body.input,
      skillIds: body.skillIds,
    });
  });
}
