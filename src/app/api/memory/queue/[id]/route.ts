import { z } from "zod";
import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import type { MemoryWrite } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const ActionInput = z.object({
  action: z.enum(["approve", "reject"]),
  // optional edits applied on approval
  title: z.string().max(200).optional(),
  markdown: z.string().max(200000).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const input = await parseBody(req, ActionInput);
    const queue = await readCollection<MemoryWrite>("memory-queue");
    const item = queue.find((q) => q.id === id);
    if (!item) throw new Error("Queue item not found");
    const updated: MemoryWrite = {
      ...item,
      title: input.title ?? item.title,
      markdown: input.markdown ?? item.markdown,
      tags: input.tags ?? item.tags,
      status: input.action === "approve" ? "approved" : "rejected",
      updatedAt: nowIso(),
    };
    await updateCollection<MemoryWrite>("memory-queue", (items) => items.map((q) => (q.id === id ? updated : q)));
    await audit({
      workspaceId: item.workspaceId,
      actorType: "user",
      actorId: "you",
      action: `memory.${input.action}`,
      targetType: "memory-write",
      targetId: id,
      details: updated.title,
    });
    return updated;
  });
}
