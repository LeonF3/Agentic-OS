"use client";

import { useState } from "react";
import { Plus, Trash2, ListPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import type { Goal, Workspace } from "@/lib/schemas";

const STATUSES: Goal["status"][] = ["idle", "active", "blocked", "complete", "failed"];

export default function GoalsPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: goals, error, mutate } = useApi<Goal[]>(ws ? `/api/goals?workspaceId=${ws.id}` : null);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [constraints, setConstraints] = useState("");
  const [milestonesText, setMilestonesText] = useState("");
  const [priority, setPriority] = useState<Goal["priority"]>("medium");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      toast("error", "Goal title is required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/goals", {
        body: {
          title,
          objective,
          constraints,
          priority,
          workspaceId: ws?.id,
          milestones: milestonesText
            .split("\n")
            .map((m) => m.trim())
            .filter(Boolean)
            .map((text) => ({ text, done: false })),
        },
      });
      setCreateOpen(false);
      setTitle("");
      setObjective("");
      setConstraints("");
      setMilestonesText("");
      mutate();
      refresh("/api/audit");
      toast("success", "Goal created");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const patchGoal = async (goal: Goal, body: Record<string, unknown>) => {
    try {
      await api(`/api/goals/${goal.id}`, { method: "PATCH", body });
      mutate();
      refresh("/api/audit");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    }
  };

  const generateTasks = async (goal: Goal) => {
    try {
      const pending = goal.milestones.filter((m) => !m.done);
      if (pending.length === 0) {
        toast("info", "No open milestones to convert — add milestones first");
        return;
      }
      for (const m of pending.slice(0, 6)) {
        await api("/api/tasks", {
          body: { title: m.text, column: "triage", workspaceId: goal.workspaceId, linkedGoalId: goal.id, description: `From goal: ${goal.title}` },
        });
      }
      refresh("/api/tasks", "/api/audit");
      toast("success", `${Math.min(pending.length, 6)} kanban card(s) created from milestones`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Task generation failed");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/goals/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      mutate();
      toast("success", "Goal deleted");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        script="Layer VI"
        title="Goals"
        description={`Standing objectives for ${ws?.name ?? "…"}. Milestones become kanban cards; progress tracks automatically as milestones complete.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New goal
          </Button>
        }
      />

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!goals && !error && <Spinner label="Loading goals…" />}
      {goals && goals.length === 0 && (
        <EmptyState
          title="No goals in this workspace"
          hint="Goals are standing objectives that agents can work toward hands-off."
          action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Create the first goal</Button>}
        />
      )}

      <div className="space-y-4">
        {(goals ?? []).map((g) => (
          <Card key={g.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-mist-100">{g.title}</h3>
                  <Badge status={g.status} />
                  <Badge status={g.priority} />
                  {g.seeded && <span className="text-[9.5px] uppercase tracking-wide text-mist-600">starter</span>}
                </div>
                {g.objective && <p className="mt-1.5 text-[13px] text-mist-400">{g.objective}</p>}
                {g.constraints && (
                  <p className="mt-1 text-[12px] text-mist-500">
                    <span className="label mr-1.5">Constraints</span>
                    {g.constraints}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={g.status} onChange={(e) => patchGoal(g, { status: e.target.value })} className="w-32" aria-label="Goal status">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Button size="sm" icon={ListPlus} onClick={() => generateTasks(g)} title="Create kanban cards from open milestones">
                  To kanban
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(g)} aria-label={`Delete ${g.title}`}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-glow to-cyan-glow transition-all" style={{ width: `${g.progress}%` }} />
              </div>
              <span className="font-mono text-[11.5px] text-mist-400">{g.progress}%</span>
            </div>

            {g.milestones.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {g.milestones.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={m.done}
                      onChange={() =>
                        patchGoal(g, { milestones: g.milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
                      }
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className={`text-[13px] ${m.done ? "text-mist-500 line-through" : "text-mist-200"}`}>{m.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10.5px] text-mist-600">Updated {timeAgo(g.updatedAt)}</p>
          </Card>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New goal">
        <div className="space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship the content pipeline" maxLength={200} />
          </Field>
          <Field label="Objective">
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} placeholder="What does done look like?" />
          </Field>
          <Field label="Constraints">
            <Textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2} placeholder="Budget, deadline, boundaries… (optional)" />
          </Field>
          <Field label="Milestones" hint="One per line — each can become a kanban card.">
            <Textarea value={milestonesText} onChange={(e) => setMilestonesText(e.target.value)} rows={3} placeholder={"First milestone\nSecond milestone"} />
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Goal["priority"])}>
              {["low", "medium", "high"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create goal</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete goal?"
        body={`"${deleteTarget?.title}" and its milestone list will be removed. Kanban cards created from it stay on the board.`}
      />
    </div>
  );
}
