"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, EmptyState, ErrorState, Input, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";
import type { AuditEvent, Workspace } from "@/lib/schemas";

export default function AuditPage() {
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: events, error, mutate } = useApi<AuditEvent[]>(ws ? `/api/audit?workspaceId=${ws.id}&limit=300` : null, 20000);
  const [filter, setFilter] = useState("");

  const filtered = (events ?? []).filter(
    (e) =>
      !filter ||
      e.action.toLowerCase().includes(filter.toLowerCase()) ||
      e.details.toLowerCase().includes(filter.toLowerCase()) ||
      e.actorId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        script="System"
        title="Audit Log"
        description={`Every consequential action in ${ws?.name ?? "…"} — who (or what) did it, to what, and when. Capped at the most recent 2000 events.`}
      />

      <div className="mb-4">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by action, actor, or detail…" aria-label="Filter audit log" />
      </div>

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!events && !error && <Spinner label="Loading audit trail…" />}
      {events && filtered.length === 0 && (
        <EmptyState title={filter ? "No events match the filter" : "No events yet"} hint="Actions land here as you and your agents work." />
      )}

      {filtered.length > 0 && (
        <Card>
          <ul className="divide-y divide-white/6">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                <span
                  className={`w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                    e.actorType === "agent" ? "text-violet-soft" : e.actorType === "system" ? "text-cyan-glow" : "text-mist-400"
                  }`}
                >
                  {e.actorType}
                </span>
                <span className="w-36 shrink-0 font-mono text-[11px] text-indigo-soft/90">{e.action}</span>
                <span className="min-w-0 flex-1 truncate text-mist-300" title={e.details}>
                  {e.details || e.targetId}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
