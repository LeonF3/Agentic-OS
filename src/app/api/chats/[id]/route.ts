import { withDb } from "@/lib/route-helpers";
import { getChatSession } from "@/lib/chats";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const detail = await getChatSession(id);
    if (!detail) throw new Error("Chat session not found");
    return detail;
  });
}
