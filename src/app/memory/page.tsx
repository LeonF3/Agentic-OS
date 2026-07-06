"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pin, Search, Check, X as XIcon, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { NOTE_TYPES, type MemoryWrite, type NoteMeta, type Workspace } from "@/lib/schemas";

export default function MemoryPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const listUrl = ws
    ? `/api/memory?workspaceId=${ws.id}${query ? `&q=${encodeURIComponent(query)}` : ""}${typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : ""}${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}`
    : null;
  const { data, error, mutate } = useApi<{ notes: NoteMeta[]; tags: { tag: string; count: number }[] }>(listUrl);
  const { data: queue, mutate: mutateQueue } = useApi<MemoryWrite[]>(ws ? `/api/memory/queue?workspaceId=${ws.id}` : null, 20000);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [noteType, setNoteType] = useState("Research");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      toast("error", "Note title is required");
      return;
    }
    setSaving(true);
    try {
      const meta = await api<NoteMeta>("/api/memory", {
        body: {
          title,
          markdown,
          type: noteType,
          workspaceId: ws?.id,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
      });
      setCreateOpen(false);
      setTitle("");
      setMarkdown("");
      setTags("");
      mutate();
      refresh("/api/audit");
      toast("success", `Note saved to the Vault (${meta.para}/)`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const act = async (item: MemoryWrite, action: "approve" | "reject") => {
    try {
      await api(`/api/memory/queue/${item.id}`, { body: { action } });
      mutateQueue();
      refresh("/api/loop");
      toast(action === "approve" ? "success" : "info", action === "approve" ? "Approved — will be written on the next Loop run" : "Rejected");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    }
  };

  const pendingQueue = (queue ?? []).filter((q) => q.status === "pending" || q.status === "failed");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Layer II"
        title="The Vault"
        description={`Markdown memory for ${ws?.name ?? "…"} — PARA-organized, Obsidian-compatible, searchable. Everything agents learn lands here.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New note
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the vault…" className="pl-9" aria-label="Search notes" />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-44" aria-label="Filter by type">
              <option value="">All types</option>
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          {tagFilter && (
            <button onClick={() => setTagFilter("")} className="flex items-center gap-1 text-xs text-indigo-soft hover:underline">
              <XIcon size={11} /> Clear tag filter: #{tagFilter}
            </button>
          )}

          {error && <ErrorState message={error.message} retry={() => mutate()} />}
          {!data && !error && <Spinner label="Opening the Vault…" />}
          {data && data.notes.length === 0 && (
            <EmptyState
              title={query || typeFilter || tagFilter ? "No notes match" : "The Vault is empty for this workspace"}
              hint={query ? "Try a different search term." : "Create a note, or run an agent — outputs flow here through the Loop."}
            />
          )}

          <ul className="space-y-2">
            {(data?.notes ?? []).map((n) => (
              <li key={n.id}>
                <Link href={`/memory/${n.id}`} className="panel panel-hover flex items-start gap-3 p-3.5">
                  {n.pinned && <Pin size={13} className="mt-1 shrink-0 text-gold" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium text-mist-100">{n.title}</span>
                      <Badge status="idle">{n.type}</Badge>
                      <span className="font-mono text-[10px] text-mist-600">{n.para}/</span>
                    </div>
                    {n.excerpt && <p className="mt-1 line-clamp-2 text-[12.5px] text-mist-400">{n.excerpt}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-mist-500">
                      {n.tags.map((t) => (
                        <span key={t} className="text-indigo-soft/80">
                          #{t}
                        </span>
                      ))}
                      <span>· {timeAgo(n.updatedAt)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <Card
            title={`Memory write queue${pendingQueue.length ? ` (${pendingQueue.length})` : ""}`}
            action={
              <button
                onClick={async () => {
                  try {
                    await api("/api/loop", { method: "POST" });
                    mutateQueue();
                    mutate();
                    toast("success", "Loop run complete");
                  } catch (err) {
                    toast("error", err instanceof Error ? err.message : "Loop failed");
                  }
                }}
                className="flex items-center gap-1 text-xs text-indigo-soft hover:underline"
              >
                <RefreshCw size={11} /> Run loop
              </button>
            }
          >
            {!queue ? (
              <Spinner />
            ) : pendingQueue.length === 0 ? (
              <p className="text-xs text-mist-500">
                Queue is clear. Agent outputs marked for review appear here for approve / edit / reject before entering the Vault.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {pendingQueue.map((q) => (
                  <li key={q.id} className="rounded-lg border border-white/10 p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge status={q.status} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-mist-200">{q.title}</span>
                    </div>
                    {q.error && <p className="mt-1 text-[11px] text-nova-soft">{q.error}</p>}
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" icon={Check} onClick={() => act(q, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" icon={XIcon} onClick={() => act(q, "reject")}>
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tags">
            {!data ? (
              <Spinner />
            ) : data.tags.length === 0 ? (
              <p className="text-xs text-mist-500">Tags appear as notes accumulate.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setTagFilter(t.tag)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      tagFilter === t.tag
                        ? "border-indigo-glow/60 bg-indigo-glow/15 text-mist-100"
                        : "border-white/12 text-mist-400 hover:border-indigo-glow/40 hover:text-mist-100"
                    }`}
                  >
                    #{t.tag} <span className="text-mist-600">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Vault on disk">
            <p className="text-xs leading-relaxed text-mist-500">
              Notes are plain <span className="font-mono">.md</span> files under{" "}
              <span className="font-mono text-mist-400">.swos-data/vault/</span> — point Obsidian at that folder to browse the same memory.
            </p>
          </Card>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New vault note" wide>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" maxLength={200} />
            </Field>
            <Field label="Type">
              <Select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
                {NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Markdown" hint="Link other notes with [[Note Title]] — backlinks are computed automatically.">
            <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={8} placeholder="Write in markdown…" className="font-mono text-[13px]" />
          </Field>
          <Field label="Tags" hint="Comma-separated.">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="research, chosn, idea" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Save to Vault</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
