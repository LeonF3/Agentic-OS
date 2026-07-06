import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { GoalPatchInput, type Goal } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const goals = await readCollection<Goal>("goals");
    const goal = goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    return goal;
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const patch = await parseBody(req, GoalPatchInput);
    const goals = await readCollection<Goal>("goals");
    const goal = goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    const milestones = patch.milestones ?? goal.milestones;
    const doneCount = milestones.filter((m) => m.done).length;
    const progress =
      patch.progress ?? (milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : goal.progress);
    const updated: Goal = {
      ...goal,
      ...patch,
      milestones,
      progress,
      status: patch.status ?? (progress === 100 ? "complete" : goal.status),
      updatedAt: nowIso(),
    };
    await updateCollection<Goal>("goals", (items) => items.map((g) => (g.id === id ? updated : g)));
    await audit({
      workspaceId: goal.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "goal.update",
      targetType: "goal",
      targetId: id,
      details: `${goal.title} → ${updated.status} (${updated.progress}%)`,
    });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const goals = await readCollection<Goal>("goals");
    const goal = goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    await updateCollection<Goal>("goals", (items) => items.filter((g) => g.id !== id));
    await audit({
      workspaceId: goal.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "goal.delete",
      targetType: "goal",
      targetId: id,
      details: goal.title,
    });
    return { deleted: id };
  });
}
