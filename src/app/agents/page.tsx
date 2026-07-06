"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, ErrorState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  description: string;
  color: string;
  status: string;
  system: boolean;
  modelRoute: string;
  runCount: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export default function AgentsPage() {
  const { data: agents, error, mutate } = useApi<AgentRow[]>("/api/agents", 20000);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Layer IV"
        title="Agent Roster"
        description="Models wrapped with tools, memory, and instructions. Every agent produces real, inspectable run records."
      />
      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!agents && !error && <Spinner label="Loading roster…" />}
      {agents && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="panel panel-hover flex flex-col gap-2.5 p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-bold text-ink-950"
                  style={{ background: a.color }}
                >
                  {a.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[14px] font-semibold text-mist-100">{a.name}</h3>
                    {a.system && <span className="rounded border border-white/15 px-1 py-px text-[9px] uppercase tracking-wide text-mist-500">core</span>}
                  </div>
                  <p className="truncate text-[11.5px] text-mist-500">{a.role}</p>
                </div>
                <Badge status={a.status} />
              </div>
              <p className="line-clamp-2 text-[12.5px] text-mist-400">{a.description}</p>
              <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-2 text-[11px] text-mist-500">
                <span className="font-mono">route: {a.modelRoute}</span>
                <span>
                  {a.runCount} run{a.runCount === 1 ? "" : "s"}
                  {a.lastRunAt ? ` · ${timeAgo(a.lastRunAt)}` : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {agents && agents.length === 0 && (
        <div className="mt-6">
          <Bot className="mx-auto text-mist-600" />
          <p className="mt-2 text-center text-sm text-mist-500">No agents found — the seed may not have run. Reload the page.</p>
        </div>
      )}
    </div>
  );
}
