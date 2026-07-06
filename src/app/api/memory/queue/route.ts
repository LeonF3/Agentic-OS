import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { MemoryWrite } from "@/lib/schemas";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    let queue = await readCollection<MemoryWrite>("memory-queue");
    if (workspaceId) queue = queue.filter((q) => q.workspaceId === workspaceId);
    return queue.slice(0, 100);
  });
}
