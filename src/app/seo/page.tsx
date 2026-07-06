"use client";

import { useState } from "react";
import { Plus, Trash2, Link2, FileJson, FileText, KanbanSquare } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Markdown from "@/components/Markdown";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import type { SeoProject, Workspace } from "@/lib/schemas";

export default function SeoPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: projects, error, mutate } = useApi<SeoProject[]>(ws ? `/api/seo?workspaceId=${ws.id}` : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SeoProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selected = projects?.find((p) => p.id === selectedId) ?? projects?.[0] ?? null;

  const create = async () => {
    if (!domain.trim()) {
      toast("error", "Domain or project name is required");
      return;
    }
    setSaving(true);
    try {
      const p = await api<SeoProject>("/api/seo", { body: { domain, description, workspaceId: ws?.id } });
      setCreateOpen(false);
      setDomain("");
      setDescription("");
      setSelectedId(p.id);
      mutate();
      toast("success", "SEO project created");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/seo/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSelectedId(null);
      mutate();
      toast("success", "Project deleted");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Layer VI"
        title="SEO"
        description={`Keyword tracking, page inventory, schema drafts, and internal-link suggestions for ${ws?.name ?? "…"}. Hermes reads from it and pushes work to the Kanban.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New project
          </Button>
        }
      />

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!projects && !error && <Spinner label="Loading SEO projects…" />}
      {projects && projects.length === 0 && (
        <EmptyState
          title="No SEO projects in this workspace"
          hint="Create one per domain or content property. Live rank tracking needs an external API and is not implemented — everything else here is real."
          action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Create project</Button>}
        />
      )}

      {projects && projects.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
                  selected?.id === p.id
                    ? "border-indigo-glow/50 bg-indigo-glow/12 text-mist-100"
                    : "border-white/12 text-mist-400 hover:border-indigo-glow/30 hover:text-mist-100"
                }`}
              >
                {p.domain}
              </button>
            ))}
          </div>
          {selected && (
            <ProjectDetail
              project={selected}
              onChange={() => mutate()}
              onDelete={() => setDeleteTarget(selected)}
            />
          )}
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New SEO project">
        <div className="space-y-4">
          <Field label="Domain / project">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. chosn.app" maxLength={200} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create project</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete SEO project?"
        body={`"${deleteTarget?.domain}" — keywords, pages, schema drafts, and link suggestions will be removed.`}
      />
    </div>
  );
}

function ProjectDetail({ project, onChange, onDelete }: { project: SeoProject; onChange: () => void; onDelete: () => void }) {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [intent, setIntent] = useState("informational");
  const [pageUrl, setPageUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageKeywords, setPageKeywords] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [brief, setBrief] = useState<{ keyword: string; content: string; provider: string } | null>(null);
  const [schemaView, setSchemaView] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    try {
      await api(`/api/seo/${project.id}`, { method: "PATCH", body });
      onChange();
      toast("success", okMsg);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    }
  };

  const generate = async (kind: string, extra: Record<string, unknown> = {}) => {
    setBusy(kind);
    try {
      const res = await api<{ kind: string; result: unknown }>(`/api/seo/${project.id}/generate`, { body: { kind, ...extra } });
      onChange();
      if (kind === "content-brief") {
        const r = res.result as { brief: string; provider: string };
        setBrief({ keyword: String(extra.keyword ?? ""), content: r.brief, provider: r.provider });
      }
      if (kind === "schema") {
        const r = res.result as { json: string };
        setSchemaView(r.json);
      }
      if (kind === "kanban-task") {
        refresh("/api/tasks");
        toast("success", "Task pushed to the Kanban board");
      }
      if (kind === "internal-links") toast("success", "Internal link suggestions updated");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Keyword tracker (${project.keywords.length})`}>
        <div className="mb-3 flex gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Add keyword…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyword.trim()) {
                patch({ addKeyword: { keyword: keyword.trim(), intent, priority: "medium", targetPage: "", notes: "" } }, "Keyword added");
                setKeyword("");
              }
            }}
          />
          <Select value={intent} onChange={(e) => setIntent(e.target.value)} className="w-40" aria-label="Search intent">
            {["informational", "commercial", "transactional", "navigational"].map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>
        {project.keywords.length === 0 ? (
          <p className="text-xs text-mist-500">Track the queries you want to win. Rank monitoring requires an external rank API (not connected).</p>
        ) : (
          <ul className="space-y-1.5">
            {project.keywords.map((k) => (
              <li key={k.keyword} className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-mist-200">{k.keyword}</span>
                <Badge status="idle">{k.intent}</Badge>
                <Button size="sm" variant="ghost" icon={FileText} title="Generate content brief" onClick={() => generate("content-brief", { keyword: k.keyword })} loading={busy === "content-brief"} />
                <Button size="sm" variant="ghost" icon={KanbanSquare} title="Push to kanban" onClick={() => generate("kanban-task", { keyword: k.keyword })} />
                <Button size="sm" variant="ghost" icon={Trash2} title="Remove keyword" onClick={() => patch({ removeKeyword: k.keyword }, "Keyword removed")} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Page inventory (${project.pages.length})`}>
        <div className="mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="/pricing or full URL" />
            <Input value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="Page title" />
          </div>
          <div className="flex gap-2">
            <Input value={pageKeywords} onChange={(e) => setPageKeywords(e.target.value)} placeholder="target keywords, comma-separated" />
            <Button
              size="sm"
              onClick={() => {
                if (!pageUrl.trim()) {
                  toast("error", "Page URL is required");
                  return;
                }
                patch(
                  {
                    addPage: {
                      url: pageUrl.trim(),
                      title: pageTitle.trim(),
                      status: "planned",
                      targetKeywords: pageKeywords.split(",").map((k) => k.trim()).filter(Boolean),
                    },
                  },
                  "Page added"
                );
                setPageUrl("");
                setPageTitle("");
                setPageKeywords("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
        {project.pages.length === 0 ? (
          <p className="text-xs text-mist-500">Add the pages you have (or plan) so schema and internal-link tools have something to work with.</p>
        ) : (
          <ul className="space-y-1.5">
            {project.pages.map((p) => (
              <li key={p.url} className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-mist-200">{p.url}</span>
                <Badge status="idle">{p.status}</Badge>
                <Button size="sm" variant="ghost" icon={FileJson} title="Generate schema" onClick={() => generate("schema", { pageUrl: p.url })} />
                <Button size="sm" variant="ghost" icon={Trash2} title="Remove page" onClick={() => patch({ removePage: p.url }, "Page removed")} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={`Internal links (${project.internalLinks.length})`}
        action={
          <Button size="sm" icon={Link2} onClick={() => generate("internal-links")} loading={busy === "internal-links"}>
            Suggest links
          </Button>
        }
      >
        {project.internalLinks.length === 0 ? (
          <p className="text-xs text-mist-500">With 2+ pages that share target keywords, SWOS computes cross-linking suggestions — deterministic, no model needed.</p>
        ) : (
          <ul className="space-y-2">
            {project.internalLinks.map((l, i) => (
              <li key={i} className="rounded-lg border border-white/8 p-2.5 text-[12.5px]">
                <span className="font-mono text-mist-200">{l.from}</span> <span className="text-mist-500">→</span>{" "}
                <span className="font-mono text-mist-200">{l.to}</span>
                <p className="mt-1 text-[11.5px] text-mist-500">
                  anchor: “{l.anchor}” — {l.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Schema drafts (${project.schemaDrafts.length})`} action={<Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete}>Delete project</Button>}>
        {project.schemaDrafts.length === 0 ? (
          <p className="text-xs text-mist-500">Generate JSON-LD from the page inventory (Article / WebSite schema).</p>
        ) : (
          <ul className="space-y-1.5">
            {project.schemaDrafts.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSchemaView(s.json)} className="text-left text-[13px] text-indigo-soft hover:underline">
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Brief viewer */}
      <Modal open={!!brief} onClose={() => setBrief(null)} title={`Content brief — ${brief?.keyword}`} wide>
        {brief && (
          <div className="space-y-3">
            <p className="text-[11px] text-mist-500">Generated by {brief.provider}. Also queued for the Vault.</p>
            <div className="inset max-h-[55vh] overflow-y-auto p-4">
              <Markdown>{brief.content}</Markdown>
            </div>
          </div>
        )}
      </Modal>

      {/* Schema viewer */}
      <Modal open={!!schemaView} onClose={() => setSchemaView(null)} title="JSON-LD schema draft" wide>
        {schemaView && (
          <div className="space-y-3">
            <pre className="inset max-h-[55vh] overflow-auto p-4 font-mono text-[12px] text-mist-200">{schemaView}</pre>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(schemaView);
                  toast("success", "Copied to clipboard");
                }}
              >
                Copy JSON-LD
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
