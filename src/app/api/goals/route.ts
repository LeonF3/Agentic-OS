import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { GoalInput, type Goal } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    let goals = await readCollection<Goal>("goals");
    if (workspaceId) goals = goals.filter((g) => g.workspaceId === workspaceId);
    return goals;
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, GoalInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const now = nowIso();
    const goal: Goal = {
      id: newId("goal"),
      workspaceId,
      title: input.title,
      objective: input.objective ?? "",
      constraints: input.constraints ?? "",
      priority: input.priority ?? "medium",
      assignedAgentIds: input.assignedAgentIds ?? [],
      status: "idle",
      milestones: input.milestones ?? [],
      progress: 0,
      seeded: false,
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<Goal>("goals", (items) => [goal, ...items]);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "goal.create",
      targetType: "goal",
      targetId: goal.id,
      details: goal.title,
    });
    return goal;
  });
}
