import { readCollection, updateCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { AgentRun } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const runs = await readCollection<AgentRun>("runs");
    const run = runs.find((r) => r.id === id);
    if (!run) throw new Error("Run not found");
    return run;
  });
}

/** Cancel a stuck run (dev adapter runs complete synchronously; this covers API hangs). */
export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const runs = await readCollection<AgentRun>("runs");
    const run = runs.find((r) => r.id === id);
    if (!run) throw new Error("Run not found");
    if (run.status !== "running" && run.status !== "queued") return run;
    const cancelled: AgentRun = {
      ...run,
      status: "cancelled",
      completedAt: nowIso(),
      logs: [...run.logs, { at: nowIso(), level: "warn" as const, message: "Cancelled by user" }],
    };
    await updateCollection<AgentRun>("runs", (items) => items.map((r) => (r.id === id ? cancelled : r)));
    await audit({
      workspaceId: run.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "run.cancel",
      targetType: "run",
      targetId: id,
      details: run.title,
    });
    return cancelled;
  });
}
