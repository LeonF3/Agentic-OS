"use client";

import { useMemo, useState, type DragEvent } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, useApi, refresh } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { KANBAN_COLUMNS, KANBAN_COLUMN_LABELS, type KanbanColumn, type TaskCard, type Workspace } from "@/lib/schemas";

interface AgentLite {
  id: string;
  name: string;
}

export default function KanbanPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: tasks, error, mutate } = useApi<TaskCard[]>(ws ? `/api/tasks?workspaceId=${ws.id}` : null, 20000);
  const { data: agents } = useApi<AgentLite[]>("/api/agents");

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
  const [dragOver, setDragOver] = useState<KanbanColumn | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<KanbanColumn, TaskCard[]>();
    for (const col of KANBAN_COLUMNS) map.set(col, []);
    for (const t of tasks ?? []) map.get(t.column)?.push(t);
    return map;
  }, [tasks]);

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

  const moveTask = async (taskId: string, column: KanbanColumn) => {
    // optimistic move
    mutate((prev) => prev?.map((t) => (t.id === taskId ? { ...t, column } : t)), { revalidate: false });
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: { column } });
      mutate();
      refresh("/api/audit");
    } catch (err) {
      mutate();
      toast("error", err instanceof Error ? err.message : "Move failed");
    }
  };

  const onDrop = (e: DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData("text/swos-task");
    if (taskId) moveTask(taskId, column);
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
        description={`Multi-agent task board for ${ws?.name ?? "…"} — Triage → Outline → Draft → Visuals → Review → Publish → Index → Repurpose. Drag cards between columns.`}
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
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col);
                }}
                onDragLeave={() => setDragOver((d) => (d === col ? null : d))}
                onDrop={(e) => onDrop(e, col)}
                className={`flex w-[240px] shrink-0 flex-col rounded-xl border p-2 transition ${
                  dragOver === col ? "border-indigo-glow/60 bg-indigo-glow/8" : "border-white/8 bg-white/[0.02]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between px-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-mist-400">{KANBAN_COLUMN_LABELS[col]}</span>
                  <span className="font-mono text-[10.5px] text-mist-500">{cards.length}</span>
                </div>
                <div className="flex min-h-[60px] flex-1 flex-col gap-2">
                  {cards.map((t) => (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/swos-task", t.id)}
                      onClick={() => setSelected(t)}
                      className="panel panel-hover cursor-grab p-2.5 text-left active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical size={12} className="mt-0.5 shrink-0 text-mist-600" />
                        <span className="flex-1 text-[12.5px] leading-snug text-mist-100">{t.title}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge status={t.priority} />
                        {t.assignedAgentId && (
                          <span className="rounded border border-white/12 px-1.5 py-px text-[10px] text-mist-400">{agentName(t.assignedAgentId) ?? "agent"}</span>
                        )}
                        {t.seeded && <span className="text-[9.5px] uppercase tracking-wide text-mist-600">starter</span>}
                        {t.checklist.length > 0 && (
                          <span className="font-mono text-[10px] text-mist-500">
                            {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
                          </span>
                        )}
                      </div>
                    </button>
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
          action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New card</Button>}
        />
      )}

      {/* Create card */}
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
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={createTask} loading={saving}>Create card</Button>
          </div>
        </div>
      </Modal>

      {/* Card detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""} wide>
        {selected && (
          <TaskDetail
            task={selected}
            agents={agents ?? []}
            onChange={() => {
              mutate();
              refresh("/api/audit");
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
  onChange,
  onDelete,
  onClose,
}: {
  task: TaskCard;
  agents: AgentLite[];
  onChange: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [checklistItem, setChecklistItem] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(task);

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

  return (
    <div className="space-y-4">
      {local.description && <p className="text-[13px] text-mist-300">{local.description}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      <div>
        <div className="label mb-1.5">Checklist</div>
        <ul className="space-y-1.5">
          {local.checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.done}
                onChange={() =>
                  patch({ checklist: local.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
                }
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
