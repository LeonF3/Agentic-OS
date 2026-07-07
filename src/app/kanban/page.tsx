"use client";

import { Suspense, useEffect, useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Play, Plus, Trash2, GripVertical } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, useApi, refresh } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { KANBAN_COLUMNS, KANBAN_COLUMN_LABELS, type Goal, type KanbanColumn, type TaskCard, type Workspace } from "@/lib/schemas";

interface AgentLite {
  id: string;
  name: string;
}

/** WIP limits mirrored from server — keep in sync with lib/kanban.ts */
const WIP_LIMITS: Partial<Record<KanbanColumn, number>> = { triage: 15, review: 8 };
function wipLimitFor(column: KanbanColumn): number | null {
  const limit = WIP_LIMITS[column];
  return limit && limit > 0 ? limit : null;
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<Spinner label="Loading board…" />}>
      <KanbanContent />
    </Suspense>
  );
}

function KanbanContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: tasks, error, mutate } = useApi<TaskCard[]>(ws ? `/api/tasks?workspaceId=${ws.id}` : null, 20000);
  const { data: agents } = useApi<AgentLite[]>("/api/agents");
  const { data: goals } = useApi<Goal[]>(ws ? `/api/goals?workspaceId=${ws.id}` : null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCol, setCreateCol] = useState<KanbanColumn>("triage");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskCard["priority"]>("medium");
  const [agentId, setAgentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<TaskCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskCard | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState<{ column: KanbanColumn; index: number } | null>(null);

  const taskParam = searchParams.get("task");

  useEffect(() => {
    if (!taskParam || !tasks) return;
    const match = tasks.find((t) => t.id === taskParam);
    if (match) setSelected(match);
  }, [taskParam, tasks]);

  useEffect(() => {
    if (selected && tasks) {
      const fresh = tasks.find((t) => t.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [tasks, selected?.id]);

  const byColumn = useMemo(() => {
    const map = new Map<KanbanColumn, TaskCard[]>();
    for (const col of KANBAN_COLUMNS) {
      const cards = (tasks ?? []).filter((t) => t.column === col).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
      map.set(col, cards);
    }
    return map;
  }, [tasks]);

  const goalTitle = (goalId: string | null) => goals?.find((g) => g.id === goalId)?.title;

  const createTask = async () => {
    if (!title.trim()) {
      toast("error", "Card title is required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/tasks", {
        body: { title, description, column: createCol, priority, assignedAgentId: agentId || null, workspaceId: ws?.id },
      });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      mutate();
      refresh("/api/audit");
      toast("success", "Card created");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (taskId: string, column: KanbanColumn, order?: number) => {
    mutate(
      (prev) => {
        if (!prev) return prev;
        const task = prev.find((t) => t.id === taskId);
        if (!task) return prev;
        const others = prev.filter((t) => t.id !== taskId);
        const inCol = others.filter((t) => t.column === column).sort((a, b) => a.order - b.order);
        const insertAt = order ?? inCol.length;
        const reordered = [...inCol.slice(0, insertAt), { ...task, column }, ...inCol.slice(insertAt)].map((t, i) => ({
          ...t,
          order: i,
        }));
        const reorderedIds = new Set(reordered.map((t) => t.id));
        return [...others.filter((t) => t.column !== column || !reorderedIds.has(t.id)), ...reordered];
      },
      { revalidate: false }
    );
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: { column, order } });
      mutate();
      refresh("/api/audit", "/api/goals", "/api/loop");
    } catch (err) {
      mutate();
      toast("error", err instanceof Error ? err.message : "Move failed");
    }
  };

  const onDrop = (e: DragEvent, column: KanbanColumn, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const taskId = e.dataTransfer.getData("text/swos-task");
    if (taskId) moveTask(taskId, column, index);
  };

  const deleteTask = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSelected(null);
      mutate();
      toast("success", "Card deleted");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const agentName = (id: string | null) => agents?.find((a) => a.id === id)?.name;

  return (
    <div>
      <PageHeader
        script="Layer VI"
        title="Kanban"
        description={`Multi-agent task board for ${ws?.name ?? "…"} — Triage → Outline → Draft → Visuals → Review → Publish → Index → Repurpose. Drag cards to reorder or move columns.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New card
          </Button>
        }
      />

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!tasks && !error && <Spinner label="Loading board…" />}

      {tasks && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const cards = byColumn.get(col) ?? [];
            const wip = wipLimitFor(col);
            const overWip = wip !== null && cards.length > wip;
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver({ column: col, index: cards.length });
                }}
                onDragLeave={() => setDragOver((d) => (d?.column === col && d.index === cards.length ? null : d))}
                onDrop={(e) => onDrop(e, col, cards.length)}
                className={`flex w-[240px] shrink-0 flex-col rounded-xl border p-2 transition ${
                  dragOver?.column === col && dragOver.index === cards.length
                    ? "border-indigo-glow/60 bg-indigo-glow/8"
                    : overWip
                      ? "border-nova-soft/40 bg-nova-soft/5"
                      : "border-white/8 bg-white/[0.02]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between px-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-mist-400">{KANBAN_COLUMN_LABELS[col]}</span>
                  <span className={`font-mono text-[10.5px] ${overWip ? "text-nova-soft" : "text-mist-500"}`}>
                    {cards.length}
                    {wip !== null && ` / ${wip}`}
                  </span>
                </div>
                <div className="flex min-h-[60px] flex-1 flex-col gap-2">
                  {cards.map((t, index) => (
                    <div
                      key={t.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver({ column: col, index });
                      }}
                      onDragLeave={() => setDragOver((d) => (d?.column === col && d.index === index ? null : d))}
                      onDrop={(e) => onDrop(e, col, index)}
                      className={dragOver?.column === col && dragOver.index === index ? "rounded-lg ring-1 ring-indigo-glow/50" : ""}
                    >
                      <button
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/swos-task", t.id)}
                        onClick={() => setSelected(t)}
                        className="panel panel-hover w-full cursor-grab p-2.5 text-left active:cursor-grabbing"
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={12} className="mt-0.5 shrink-0 text-mist-600" />
                          <span className="flex-1 text-[12.5px] leading-snug text-mist-100">{t.title}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge status={t.priority} />
                          {t.assignedAgentId && (
                            <span className="rounded border border-white/12 px-1.5 py-px text-[10px] text-mist-400">
                              {agentName(t.assignedAgentId) ?? "agent"}
                            </span>
                          )}
                          {t.linkedGoalId && (
                            <span className="rounded border border-indigo-glow/30 px-1.5 py-px text-[10px] text-indigo-glow/80">goal</span>
                          )}
                          {t.dueDate && (
                            <span className="font-mono text-[10px] text-mist-500">{t.dueDate.slice(0, 10)}</span>
                          )}
                          {t.seeded && <span className="text-[9.5px] uppercase tracking-wide text-mist-600">starter</span>}
                          {t.checklist.length > 0 && (
                            <span className="font-mono text-[10px] text-mist-500">
                              {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                  {cards.length === 0 && <div className="rounded-lg border border-dashed border-white/8 py-4 text-center text-[10.5px] text-mist-600">Drop cards here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tasks && tasks.length === 0 && (
        <EmptyState
          title="The board is empty"
          hint="Create your first card, or generate SEO/Goal tasks from those screens — they land here."
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              New card
            </Button>
          }
        />
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New kanban card">
        <div className="space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" maxLength={200} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional details" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Column">
              <Select value={createCol} onChange={(e) => setCreateCol(e.target.value as KanbanColumn)}>
                {KANBAN_COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {KANBAN_COLUMN_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskCard["priority"])}>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Assign agent" hint="Optional — which agent owns this card.">
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Unassigned</option>
              {(agents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={createTask} loading={saving}>
              Create card
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""} wide>
        {selected && (
          <TaskDetail
            task={selected}
            agents={agents ?? []}
            goalTitle={goalTitle(selected.linkedGoalId)}
            onChange={() => {
              mutate();
              refresh("/api/audit", "/api/goals", "/api/loop");
            }}
            onDelete={() => setDeleteTarget(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTask}
        loading={deleting}
        title="Delete card?"
        body={`"${deleteTarget?.title}" will be permanently removed from the board.`}
      />
    </div>
  );
}

function TaskDetail({
  task,
  agents,
  goalTitle,
  onChange,
  onDelete,
  onClose,
}: {
  task: TaskCard;
  agents: AgentLite[];
  goalTitle?: string;
  onChange: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [checklistItem, setChecklistItem] = useState("");
  const [comment, setComment] = useState("");
  const [runPrompt, setRunPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [local, setLocal] = useState(task);

  useEffect(() => {
    setLocal(task);
  }, [task]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const updated = await api<TaskCard>(`/api/tasks/${task.id}`, { method: "PATCH", body });
      setLocal(updated);
      onChange();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const runAgent = async () => {
    const agentId = local.assignedAgentId;
    if (!agentId) {
      toast("error", "Assign an agent to this card first");
      return;
    }
    setRunning(true);
    try {
      const result = await api<{ status: string; error?: string }>(`/api/agents/${agentId}/run`, {
        body: {
          input: runPrompt.trim() || `Work on kanban card: ${local.title}`,
          workspaceId: local.workspaceId,
          taskId: local.id,
          title: local.title,
        },
      });
      setRunPrompt("");
      onChange();
      refresh("/api/runs", "/api/memory", "/api/loop", "/api/agents");
      if (result.status === "failed") toast("error", result.error ?? "Run failed");
      else toast("success", "Agent run complete — output added to card comments");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const assignedName = agents.find((a) => a.id === local.assignedAgentId)?.name;

  return (
    <div className="space-y-4">
      {local.linkedGoalId && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-glow/20 bg-indigo-glow/5 px-3 py-2 text-[12.5px]">
          <span className="text-mist-400">Linked goal:</span>
          <Link href="/goals" className="text-indigo-glow hover:underline">
            {goalTitle ?? local.linkedGoalId}
          </Link>
          <ExternalLink size={12} className="text-mist-500" />
        </div>
      )}

      <Field label="Description">
        <Textarea
          value={local.description}
          onChange={(e) => setLocal({ ...local, description: e.target.value })}
          onBlur={() => {
            if (local.description !== task.description) patch({ description: local.description });
          }}
          rows={3}
          disabled={busy}
          placeholder="What should happen on this card?"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Column">
          <Select value={local.column} onChange={(e) => patch({ column: e.target.value })} disabled={busy}>
            {KANBAN_COLUMNS.map((c) => (
              <option key={c} value={c}>
                {KANBAN_COLUMN_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={local.priority} onChange={(e) => patch({ priority: e.target.value })} disabled={busy}>
            {["low", "medium", "high", "urgent"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input
            type="date"
            value={local.dueDate?.slice(0, 10) ?? ""}
            onChange={(e) => patch({ dueDate: e.target.value || null })}
            disabled={busy}
          />
        </Field>
        <Field label="Agent">
          <Select value={local.assignedAgentId ?? ""} onChange={(e) => patch({ assignedAgentId: e.target.value || null })} disabled={busy}>
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {local.assignedAgentId && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="label mb-2">Run {assignedName ?? "agent"} on this card</div>
          <Textarea
            value={runPrompt}
            onChange={(e) => setRunPrompt(e.target.value)}
            rows={2}
            placeholder="Optional extra instructions (card title + description are sent automatically)"
            disabled={running}
          />
          <Button variant="primary" size="sm" icon={Play} className="mt-2" onClick={runAgent} loading={running}>
            Run agent
          </Button>
          <p className="mt-1.5 text-[11px] text-mist-500">On success the card advances one column and output is logged as a comment.</p>
        </div>
      )}

      <div>
        <div className="label mb-1.5">Checklist</div>
        <ul className="space-y-1.5">
          {local.checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.done}
                onChange={() => patch({ checklist: local.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                className="h-4 w-4 cursor-pointer"
              />
              <span className={`text-[13px] ${c.done ? "text-mist-500 line-through" : "text-mist-200"}`}>{c.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            value={checklistItem}
            onChange={(e) => setChecklistItem(e.target.value)}
            placeholder="Add checklist item"
            onKeyDown={(e) => {
              if (e.key === "Enter" && checklistItem.trim()) {
                patch({ checklist: [...local.checklist, { text: checklistItem.trim(), done: false }] });
                setChecklistItem("");
              }
            }}
          />
        </div>
      </div>

      <div>
        <div className="label mb-1.5">Comments & logs</div>
        {local.comments.length === 0 && <p className="text-xs text-mist-500">No comments yet.</p>}
        <ul className="space-y-1.5">
          {local.comments.map((c, i) => (
            <li key={i} className="rounded-lg border border-white/8 px-2.5 py-1.5 text-[12.5px] text-mist-300">
              <span className="mr-2 font-mono text-[10px] text-mist-500">{new Date(c.at).toLocaleString()}</span>
              <span className="mr-2 text-[10px] text-mist-600">{c.author}</span>
              {c.text}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (Enter to post)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                patch({ comment: comment.trim() });
                setComment("");
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/8 pt-3">
        <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
          Delete card
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
