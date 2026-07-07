import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import { getSettings } from "./modelrouter";
import type { Goal, KanbanColumn, MemoryWrite, TaskCard, Workspace } from "./schemas";
import { KANBAN_COLUMNS } from "./schemas";

/** WIP limits per column (omit or 0 = unlimited). */
export const KANBAN_WIP_LIMITS: Partial<Record<KanbanColumn, number>> = {
  triage: 15,
  review: 8,
};

export function wipLimitFor(column: KanbanColumn): number | null {
  const limit = KANBAN_WIP_LIMITS[column];
  return limit && limit > 0 ? limit : null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  column?: KanbanColumn;
  priority?: TaskCard["priority"];
  assignedAgentId?: string | null;
  linkedGoalId?: string | null;
  linkedMilestoneIndex?: number | null;
  dueDate?: string | null;
  workspaceId?: string;
}

export interface PatchTaskInput {
  title?: string;
  description?: string;
  column?: KanbanColumn;
  order?: number;
  priority?: TaskCard["priority"];
  assignedAgentId?: string | null;
  linkedGoalId?: string | null;
  linkedMilestoneIndex?: number | null;
  dueDate?: string | null;
  checklist?: TaskCard["checklist"];
  comment?: string;
}

function columnTasks(tasks: TaskCard[], workspaceId: string, column: KanbanColumn): TaskCard[] {
  return tasks
    .filter((t) => t.workspaceId === workspaceId && t.column === column)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

function applyColumnOrder(
  tasks: TaskCard[],
  workspaceId: string,
  column: KanbanColumn,
  orderedIds: string[]
): TaskCard[] {
  const idSet = new Set(orderedIds);
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  return tasks.map((t) => {
    if (t.workspaceId !== workspaceId || t.column !== column || !idSet.has(t.id)) return t;
    return { ...t, order: orderMap.get(t.id) ?? t.order, updatedAt: nowIso() };
  });
}

export async function listTasks(opts?: { workspaceId?: string; agentId?: string }): Promise<TaskCard[]> {
  let tasks = await readCollection<TaskCard>("tasks");
  if (opts?.workspaceId) tasks = tasks.filter((t) => t.workspaceId === opts.workspaceId);
  if (opts?.agentId) tasks = tasks.filter((t) => t.assignedAgentId === opts.agentId);
  return tasks.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export async function getTask(id: string): Promise<TaskCard | null> {
  const tasks = await readCollection<TaskCard>("tasks");
  return tasks.find((t) => t.id === id) ?? null;
}

export async function createKanbanTask(input: CreateTaskInput, actorId = "you"): Promise<TaskCard> {
  const settings = await getSettings();
  const workspaceId = input.workspaceId || settings.activeWorkspaceId;
  const now = nowIso();
  const existing = await readCollection<TaskCard>("tasks");
  const column = input.column ?? "triage";
  const inCol = columnTasks(existing, workspaceId, column);
  const task: TaskCard = {
    id: newId("task"),
    workspaceId,
    title: input.title,
    description: input.description ?? "",
    column,
    order: inCol.length,
    priority: input.priority ?? "medium",
    assignedAgentId: input.assignedAgentId ?? null,
    linkedGoalId: input.linkedGoalId ?? null,
    linkedMilestoneIndex: input.linkedMilestoneIndex ?? null,
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
    actorType: actorId === "you" ? "user" : "agent",
    actorId,
    action: "task.create",
    targetType: "task",
    targetId: task.id,
    details: task.title,
  });
  return task;
}

export async function moveKanbanTask(
  taskId: string,
  column: KanbanColumn,
  order?: number,
  actorId = "you"
): Promise<TaskCard> {
  const tasks = await readCollection<TaskCard>("tasks");
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  const previousColumn = task.column;
  const targetCol = columnTasks(tasks, task.workspaceId, column).filter((t) => t.id !== taskId);
  const insertAt = order ?? targetCol.length;
  const clamped = Math.max(0, Math.min(insertAt, targetCol.length));
  const orderedIds = [...targetCol.slice(0, clamped).map((t) => t.id), taskId, ...targetCol.slice(clamped).map((t) => t.id)];

  let updated = tasks.map((t) =>
    t.id === taskId ? { ...t, column, order: clamped, updatedAt: nowIso() } : t
  );
  updated = applyColumnOrder(updated, task.workspaceId, column, orderedIds);
  if (previousColumn !== column) {
    const prevIds = columnTasks(updated, task.workspaceId, previousColumn).map((t) => t.id);
    updated = applyColumnOrder(updated, task.workspaceId, previousColumn, prevIds);
  }

  const result = updated.find((t) => t.id === taskId)!;
  await updateCollection<TaskCard>("tasks", () => updated);

  if (previousColumn !== column) {
    await audit({
      workspaceId: task.workspaceId,
      actorType: actorId === "you" ? "user" : "agent",
      actorId,
      action: "task.move",
      targetType: "task",
      targetId: taskId,
      details: `${task.title}: ${previousColumn} → ${column}`,
    });
    const workspaces = await readCollection<Workspace>("workspaces");
    const afterAutomation = await handleColumnAutomation(result, previousColumn, workspaces);
    if (afterAutomation.id === result.id) {
      await syncGoalFromTask(afterAutomation);
      return afterAutomation;
    }
  }

  await syncGoalFromTask(result);
  return (await getTask(taskId)) ?? result;
}

export async function patchKanbanTask(id: string, patch: PatchTaskInput, actorId = "you"): Promise<TaskCard> {
  if (patch.column !== undefined && patch.order !== undefined) {
    return moveKanbanTask(id, patch.column, patch.order, actorId);
  }
  if (patch.column !== undefined) {
    return moveKanbanTask(id, patch.column, undefined, actorId);
  }
  if (patch.order !== undefined) {
    const task = await getTask(id);
    if (!task) throw new Error("Task not found");
    return moveKanbanTask(id, task.column, patch.order, actorId);
  }

  const tasks = await readCollection<TaskCard>("tasks");
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error("Task not found");

  const updated: TaskCard = {
    ...task,
    ...patch,
    description: patch.description ?? task.description,
    comments: patch.comment
      ? [...task.comments, { at: nowIso(), author: actorId === "you" ? "you" : actorId, text: patch.comment }]
      : task.comments,
    updatedAt: nowIso(),
  };
  delete (updated as Record<string, unknown>).comment;

  await updateCollection<TaskCard>("tasks", (items) => items.map((t) => (t.id === id ? updated : t)));
  await syncGoalFromTask(updated);
  return updated;
}

export async function appendTaskComment(taskId: string, author: string, text: string): Promise<TaskCard> {
  return patchKanbanTask(taskId, { comment: text }, author);
}

export async function syncGoalFromTask(task: TaskCard): Promise<void> {
  if (!task.linkedGoalId || task.linkedMilestoneIndex == null) return;

  const goals = await readCollection<Goal>("goals");
  const goal = goals.find((g) => g.id === task.linkedGoalId);
  if (!goal || task.linkedMilestoneIndex >= goal.milestones.length) return;

  const milestoneDone =
    task.column === "publish" ||
    task.column === "index" ||
    task.column === "repurpose" ||
    (task.checklist.length > 0 && task.checklist.every((c) => c.done));

  const milestones = goal.milestones.map((m, i) =>
    i === task.linkedMilestoneIndex ? { ...m, done: milestoneDone } : m
  );
  const doneCount = milestones.filter((m) => m.done).length;
  const progress = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : goal.progress;

  await updateCollection<Goal>("goals", (items) =>
    items.map((g) =>
      g.id === goal.id
        ? {
            ...g,
            milestones,
            progress,
            status: progress === 100 ? "complete" : g.status === "complete" ? "active" : g.status,
            updatedAt: nowIso(),
          }
        : g
    )
  );
}

export async function handleColumnAutomation(
  task: TaskCard,
  previousColumn: KanbanColumn,
  workspaces: Workspace[]
): Promise<TaskCard> {
  if (task.column === previousColumn) return task;

  const publishColumns: KanbanColumn[] = ["publish", "index"];
  const enteringPublish = publishColumns.includes(task.column) && !publishColumns.includes(previousColumn);
  if (!enteringPublish) return task;

  const ws = workspaces.find((w) => w.id === task.workspaceId);
  if (!ws) return task;

  const settings = await getSettings();
  const mw: MemoryWrite = {
    id: newId("queue"),
    workspaceId: task.workspaceId,
    title: `Kanban: ${task.title}`,
    type: "Project",
    markdown: [
      `**Source:** Kanban card \`${task.id}\``,
      `**Column:** ${task.column}`,
      task.linkedGoalId ? `**Goal:** ${task.linkedGoalId}` : "",
      "",
      "## Description",
      task.description || "_No description_",
      "",
      task.checklist.length > 0
        ? "## Checklist\n" + task.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["kanban", task.column, "loop"],
    sourceType: "kanban",
    sourceId: task.id,
    status: settings.autoWriteRunLogs ? "auto" : "pending",
    error: null,
    noteId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await updateCollection<MemoryWrite>("memory-queue", (items) => [mw, ...items]);

  const comment = `Queued for Vault (${mw.status}) — card moved to ${task.column}`;
  return patchKanbanTask(task.id, { comment }, "system");
}

/** Columns that advance after a successful agent run on a card. */
export const AGENT_RUN_COLUMN_ADVANCE: Partial<Record<KanbanColumn, KanbanColumn>> = {
  triage: "outline",
  outline: "draft",
  draft: "review",
  visuals: "review",
};

export async function advanceTaskAfterAgentRun(taskId: string): Promise<TaskCard | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  const next = AGENT_RUN_COLUMN_ADVANCE[task.column];
  if (!next) return task;
  return moveKanbanTask(taskId, next, undefined, "system");
}

export interface KanbanCreateAction {
  title: string;
  column?: KanbanColumn;
  description?: string;
  priority?: TaskCard["priority"];
}

export interface KanbanMoveAction {
  taskId: string;
  column: KanbanColumn;
}

export interface KanbanActions {
  create?: KanbanCreateAction[];
  move?: KanbanMoveAction[];
}

export function kanbanToolsSystemPrompt(): string {
  return [
    "You may create or move kanban cards when helpful. Append a JSON block at the end of your response:",
    "```swos-kanban",
    '{"create":[{"title":"Task title","column":"triage","description":"optional"}],"move":[{"taskId":"task_xxx","column":"review"}]}',
    "```",
    `Valid columns: ${KANBAN_COLUMNS.join(", ")}.`,
    "Omit create or move arrays if unused. Do not include the block if no kanban changes are needed.",
  ].join("\n");
}

export function parseKanbanActions(output: string): { cleanOutput: string; actions: KanbanActions | null } {
  const match = output.match(/```swos-kanban\s*([\s\S]*?)```/);
  if (!match) return { cleanOutput: output, actions: null };
  const cleanOutput = output.replace(match[0], "").trimEnd();
  try {
    const parsed = JSON.parse(match[1].trim()) as KanbanActions;
    return { cleanOutput, actions: parsed };
  } catch {
    return { cleanOutput: output, actions: null };
  }
}

export async function executeKanbanActions(
  actions: KanbanActions,
  workspaceId: string,
  agentId: string
): Promise<string[]> {
  const logs: string[] = [];
  for (const c of actions.create ?? []) {
    const task = await createKanbanTask(
      {
        title: c.title,
        column: c.column ?? "triage",
        description: c.description,
        priority: c.priority,
        workspaceId,
      },
      agentId
    );
    logs.push(`kanban.create → "${task.title}" (${task.column})`);
  }
  for (const m of actions.move ?? []) {
    if (!KANBAN_COLUMNS.includes(m.column)) continue;
    await moveKanbanTask(m.taskId, m.column, undefined, agentId);
    logs.push(`kanban.move → ${m.taskId} → ${m.column}`);
  }
  return logs;
}

export function agentHasKanbanTools(tools: string[]): boolean {
  return tools.some((t) => t === "kanban.create" || t === "kanban.move");
}

export function buildTaskRunPrompt(task: TaskCard): string {
  const lines = [
    `## Kanban card: ${task.title}`,
    `Column: ${task.column} · Priority: ${task.priority}`,
    task.description ? `\n${task.description}` : "",
  ];
  if (task.checklist.length > 0) {
    lines.push("\n### Checklist");
    for (const c of task.checklist) lines.push(`- [${c.done ? "x" : " "}] ${c.text}`);
  }
  lines.push("\n---\nComplete the work described above. Be specific and actionable.");
  return lines.filter(Boolean).join("\n");
}
