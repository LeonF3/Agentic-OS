import { withDb, parseBody } from "@/lib/route-helpers";
import { ChatMessageInput } from "@/lib/schemas";
import { continueChatSession } from "@/lib/chats";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const { input, skillIds } = await parseBody(req, ChatMessageInput);
    return continueChatSession(id, input, skillIds);
  });
}
