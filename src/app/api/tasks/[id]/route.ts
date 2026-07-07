import { updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { TaskPatchInput, type TaskCard } from "@/lib/schemas";
import { getTask, patchKanbanTask } from "@/lib/kanban";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) throw new Error("Task not found");
    return task;
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const patch = await parseBody(req, TaskPatchInput);
    return patchKanbanTask(id, patch);
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const task = await getTask(id);
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
