import { withDb, parseBody } from "@/lib/route-helpers";
import { TaskInput } from "@/lib/schemas";
import { createKanbanTask, listTasks } from "@/lib/kanban";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const agentId = url.searchParams.get("agentId") ?? undefined;
    return listTasks({ workspaceId, agentId });
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, TaskInput);
    return createKanbanTask({
      title: input.title,
      description: input.description,
      column: input.column,
      priority: input.priority,
      assignedAgentId: input.assignedAgentId,
      linkedGoalId: input.linkedGoalId,
      linkedMilestoneIndex: input.linkedMilestoneIndex,
      dueDate: input.dueDate,
      workspaceId: input.workspaceId,
    });
  });
}
