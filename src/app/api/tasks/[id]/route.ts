import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { TaskPatchInput, type TaskCard } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const tasks = await readCollection<TaskCard>("tasks");
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error("Task not found");
    return task;
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const patch = await parseBody(req, TaskPatchInput);
    const tasks = await readCollection<TaskCard>("tasks");
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error("Task not found");
    const moved = patch.column && patch.column !== task.column;
    const updated: TaskCard = {
      ...task,
      ...patch,
      description: patch.description ?? task.description,
      comments: patch.comment
        ? [...task.comments, { at: nowIso(), author: "you", text: patch.comment }]
        : task.comments,
      updatedAt: nowIso(),
    };
    delete (updated as Record<string, unknown>).comment;
    await updateCollection<TaskCard>("tasks", (items) => items.map((t) => (t.id === id ? updated : t)));
    if (moved) {
      await audit({
        workspaceId: task.workspaceId,
        actorType: "user",
        actorId: "you",
        action: "task.move",
        targetType: "task",
        targetId: id,
        details: `${task.title}: ${task.column} → ${patch.column}`,
      });
    }
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const tasks = await readCollection<TaskCard>("tasks");
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error("Task not found");
    await updateCollection<TaskCard>("tasks", (items) => items.filter((t) => t.id !== id));
    await audit({
      workspaceId: task.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "task.delete",
      targetType: "task",
      targetId: id,
      details: task.title,
    });
    return { deleted: id };
  });
}
