"use client";

import Link from "next/link";
import { Activity, ArrowRight, Bot, KanbanSquare, Library, RefreshCw, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import QuickPrompt from "@/components/QuickPrompt";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { timeAgo, truncate } from "@/lib/format";
import { KANBAN_COLUMN_LABELS, type AgentRun, type AuditEvent, type Goal, type TaskCard, type Workspace } from "@/lib/schemas";

interface AgentWithStats {
  id: string;
  name: string;
  role: string;
  status: string;
  runCount: number;
  color: string;
}

export default function MissionControl() {
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const wsQ = ws ? `?workspaceId=${ws.id}` : "";

  const { data: agents } = useApi<AgentWithStats[]>("/api/agents");
  const { data: runs } = useApi<AgentRun[]>(ws ? `/api/runs${wsQ}&limit=6` : null, 15000);
  const { data: goals } = useApi<Goal[]>(ws ? `/api/goals${wsQ}` : null);
  const { data: tasks } = useApi<TaskCard[]>(ws ? `/api/tasks${wsQ}` : null);
  const { data: events } = useApi<AuditEvent[]>(ws ? `/api/audit${wsQ}&limit=10` : null, 15000);
  const { data: loop } = useApi<{ pending: number; failed: number; lastRunAt: string | null }>("/api/loop", 30000);

  const activeGoals = (goals ?? []).filter((g) => g.status === "active");
  const columnCounts = (tasks ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.column] = (acc[t.column] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Mission Control"
        title={ws ? `${ws.name}` : "Loading…"}
        description={
          ws?.description ||
          "One dashboard, every agent. Route work, watch activity, and let the Loop compound your context."
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick prompt */}
        <Card title="Quick prompt" className="lg:col-span-2">
          {agents ? (
            agents.length > 0 ? (
              <QuickPrompt agents={agents.filter((a) => a.status !== "disabled")} />
            ) : (
              <EmptyState title="No agents available" hint="Check the Agent Roster." />
            )
          ) : (
            <Spinner />
          )}
        </Card>

        {/* Loop status */}
        <Card
          title="The Loop"
          action={
            <Link href="/memory" className="text-xs text-indigo-soft hover:underline">
              Review queue
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className="text-indigo-soft" />
              <div>
                <p className="text-sm text-mist-100">
                  {loop ? `${loop.pending} write(s) queued` : "Checking…"}
                  {loop && loop.failed > 0 && <span className="text-nova-soft"> · {loop.failed} failed</span>}
                </p>
                <p className="text-[11px] text-mist-500">Last run {timeAgo(loop?.lastRunAt)}</p>
              </div>
            </div>
            <p className="text-xs text-mist-500">
              Every output flows back to the Vault as structured notes. Run it from the top bar anytime.
            </p>
          </div>
        </Card>

        {/* Active goals */}
        <Card
          title="Active goals"
          action={
            <Link href="/goals" className="flex items-center gap-1 text-xs text-indigo-soft hover:underline">
              All goals <ArrowRight size={11} />
            </Link>
          }
        >
          {!goals ? (
            <Spinner />
          ) : activeGoals.length === 0 ? (
            <EmptyState icon={Target} title="No active goals" hint="Create a goal and set it active — agents can generate kanban tasks from it." />
          ) : (
            <ul className="space-y-2.5">
              {activeGoals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <Link href="/goals" className="block rounded-lg border border-white/8 p-2.5 transition hover:border-indigo-glow/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-mist-100">{g.title}</span>
                      <span className="font-mono text-[11px] text-mist-500">{g.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-glow to-cyan-glow" style={{ width: `${g.progress}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent runs */}
        <Card
          title="Recent agent runs"
          action={
            <Link href="/agents" className="flex items-center gap-1 text-xs text-indigo-soft hover:underline">
              Roster <ArrowRight size={11} />
            </Link>
          }
        >
          {!runs ? (
            <Spinner />
          ) : runs.length === 0 ? (
            <EmptyState icon={Bot} title="No runs yet in this workspace" hint="Use the quick prompt above — every run is recorded here." />
          ) : (
            <ul className="space-y-2">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 rounded-lg border border-white/8 px-2.5 py-2">
                  <Badge status={r.status} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-mist-300">{r.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(r.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Kanban summary */}
        <Card
          title="Kanban"
          action={
            <Link href="/kanban" className="flex items-center gap-1 text-xs text-indigo-soft hover:underline">
              Board <ArrowRight size={11} />
            </Link>
          }
        >
          {!tasks ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <EmptyState icon={KanbanSquare} title="Board is clear" hint="Create cards on the Kanban screen or let SEO/Goals generate them." />
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(KANBAN_COLUMN_LABELS).map(([col, label]) =>
                columnCounts[col] ? (
                  <li key={col} className="flex items-center justify-between text-[13px]">
                    <span className="text-mist-400">{label}</span>
                    <span className="font-mono text-mist-100">{columnCounts[col]}</span>
                  </li>
                ) : null
              )}
            </ul>
          )}
        </Card>

        {/* Live activity */}
        <Card title="Live activity" className="lg:col-span-3">
          {!events ? (
            <Spinner />
          ) : events.length === 0 ? (
            <EmptyState icon={Activity} title="Quiet in here" hint="Actions across the OS — runs, notes, moves, switches — show up here." />
          ) : (
            <ul className="divide-y divide-white/6">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="font-mono text-[10.5px] uppercase tracking-wide text-indigo-soft/80">{e.action}</span>
                  <span className="min-w-0 flex-1 truncate text-mist-300">{truncate(e.details || e.targetId, 100)}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Memory teaser */}
        <Card title="The Vault" className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Library size={18} className="text-violet-soft" />
              <p className="text-[13px] text-mist-400">
                Markdown memory, PARA-organized, Obsidian-compatible. Agents read from it and write back through the Loop.
              </p>
            </div>
            <Link href="/memory" className="flex items-center gap-1 text-xs text-indigo-soft hover:underline">
              Open the Vault <ArrowRight size={11} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
