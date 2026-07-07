"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, EmptyState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";
import { BUCKETS, BUCKET_LABELS, type AgentRun, type Bucket, type ChatSession, type Goal, type NoteMeta, type StudioAsset, type TaskCard, type Workspace } from "@/lib/schemas";

interface BucketItem {
  id: string;
  title: string;
  subtitle: string;
  href: string | null;
  at: string;
}

export default function WorkspaceBucketsPage() {
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const wsQ = ws ? `?workspaceId=${ws.id}` : "";

  const { data: runs } = useApi<AgentRun[]>(ws ? `/api/runs${wsQ}&limit=100` : null);
  const { data: chatSessions } = useApi<ChatSession[]>(ws ? `/api/chats${wsQ}&limit=100` : null);
  const { data: tasks } = useApi<TaskCard[]>(ws ? `/api/tasks${wsQ}` : null);
  const { data: goals } = useApi<Goal[]>(ws ? `/api/goals${wsQ}` : null);
  const { data: assets } = useApi<StudioAsset[]>(ws ? `/api/studio${wsQ}` : null);
  const { data: memory } = useApi<{ notes: NoteMeta[] }>(ws ? `/api/memory${wsQ}` : null);

  const [bucket, setBucket] = useState<Bucket>("agent-runs");

  const loaded = runs && chatSessions && tasks && goals && assets && memory;

  const buckets = useMemo(() => {
    const map = new Map<Bucket, BucketItem[]>();
    for (const b of BUCKETS) map.set(b, []);
    if (!loaded) return map;

    for (const r of runs!) {
      map.get("agent-runs")!.push({ id: r.id, title: r.title, subtitle: `${r.status} · ${r.model}`, href: null, at: r.startedAt });
    }
    for (const s of chatSessions!) {
      map.get("chats")!.push({ id: s.id, title: s.title, subtitle: "session", href: `/chats?session=${s.id}`, at: s.updatedAt });
    }
    for (const t of tasks!) map.get("tasks")!.push({ id: t.id, title: t.title, subtitle: t.column, href: "/kanban", at: t.updatedAt });
    for (const g of goals!) map.get("goals")!.push({ id: g.id, title: g.title, subtitle: `${g.status} · ${g.progress}%`, href: "/goals", at: g.updatedAt });
    for (const n of memory!.notes) {
      map.get("notes")!.push({ id: n.id, title: n.title, subtitle: n.type, href: `/memory/${n.id}`, at: n.updatedAt });
      if (n.type === "Research") map.get("research")!.push({ id: `r-${n.id}`, title: n.title, subtitle: "Research note", href: `/memory/${n.id}`, at: n.updatedAt });
      if (n.type === "Content Output") map.get("seo-content")!.push({ id: `s-${n.id}`, title: n.title, subtitle: "Content output", href: `/memory/${n.id}`, at: n.updatedAt });
      if (n.type === "Code Change") map.get("code")!.push({ id: `cc-${n.id}`, title: n.title, subtitle: "Code change", href: `/memory/${n.id}`, at: n.updatedAt });
    }
    for (const a of assets!) {
      const target: Bucket =
        a.type === "image" ? "images" : a.type === "video" ? "video" : a.type === "audio" ? "audio" : a.type === "html" ? "code" : "documents";
      map.get(target)!.push({ id: a.id, title: a.title, subtitle: a.provider === "upload" ? "uploaded" : "prompt package", href: "/studio", at: a.createdAt });
      if (a.provider === "upload") map.get("exports")!.push({ id: `e-${a.id}`, title: a.title, subtitle: a.mimeType ?? "file", href: "/studio", at: a.createdAt });
    }
    for (const items of map.values()) items.sort((a, b) => (a.at < b.at ? 1 : -1));
    return map;
  }, [loaded, runs, chatSessions, tasks, goals, assets, memory]);

  const current = buckets.get(bucket) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Layer VI"
        title="Workspace Buckets"
        description={`Every output any agent or screen produces in ${ws?.name ?? "…"}, organized into 13 buckets. Data never crosses workspaces.`}
      />

      {!loaded ? (
        <Spinner label="Gathering outputs…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <ul className="space-y-1">
              {BUCKETS.map((b) => {
                const count = buckets.get(b)?.length ?? 0;
                return (
                  <li key={b}>
                    <button
                      onClick={() => setBucket(b)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] transition ${
                        bucket === b
                          ? "border-indigo-glow/40 bg-indigo-glow/12 text-mist-100"
                          : "border-transparent text-mist-400 hover:bg-white/5 hover:text-mist-100"
                      }`}
                    >
                      <span>{BUCKET_LABELS[b]}</span>
                      <span className="font-mono text-[11px] text-mist-500">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <Card title={BUCKET_LABELS[bucket]}>
              {current.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="Bucket is empty"
                  hint="Outputs land here automatically as you work — runs, notes, tasks, media, everything."
                />
              ) : (
                <ul className="divide-y divide-white/6">
                  {current.slice(0, 60).map((item) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} className="flex items-center gap-3 py-2.5 transition hover:bg-white/3">
                          <span className="min-w-0 flex-1 truncate text-[13px] text-mist-200">{item.title}</span>
                          <Badge status="idle">{item.subtitle}</Badge>
                          <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(item.at)}</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-[13px] text-mist-200">{item.title}</span>
                          <Badge status="idle">{item.subtitle}</Badge>
                          <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(item.at)}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
