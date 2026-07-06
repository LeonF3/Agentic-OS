import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { TaskInput, type TaskCard } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const agentId = url.searchParams.get("agentId");
    let tasks = await readCollection<TaskCard>("tasks");
    if (workspaceId) tasks = tasks.filter((t) => t.workspaceId === workspaceId);
    if (agentId) tasks = tasks.filter((t) => t.assignedAgentId === agentId);
    return tasks.sort((a, b) => a.order - b.order);
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, TaskInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const now = nowIso();
    const existing = await readCollection<TaskCard>("tasks");
    const column = input.column ?? "triage";
    const maxOrder = Math.max(0, ...existing.filter((t) => t.workspaceId === workspaceId && t.column === column).map((t) => t.order + 1));
    const task: TaskCard = {
      id: newId("task"),
      workspaceId,
      title: input.title,
      description: input.description ?? "",
      column,
      order: maxOrder,
      priority: input.priority ?? "medium",
      assignedAgentId: input.assignedAgentId ?? null,
      linkedGoalId: input.linkedGoalId ?? null,
      linkedNoteIds: [],
      checklist: [],
      comments: [],
      dueDate: input.dueDate ?? null,
      seeded: false,
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<TaskCard>("tasks", (items) => [...items, task]);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "task.create",
      targetType: "task",
      targetId: task.id,
      details: task.title,
    });
    return task;
  });
}
