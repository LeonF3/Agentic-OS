"use client";

import { useState } from "react";
import { Plus, Trash2, Sparkles, FileDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Markdown from "@/components/Markdown";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import type { Notebook, Workspace } from "@/lib/schemas";

const OUTPUT_KINDS = [
  { id: "summary", label: "Summary" },
  { id: "podcast-outline", label: "Podcast outline" },
  { id: "infographic-outline", label: "Infographic outline" },
  { id: "repurpose-plan", label: "Repurpose plan" },
] as const;

export default function NotebookPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: notebooks, error, mutate } = useApi<Notebook[]>(ws ? `/api/notebooks?workspaceId=${ws.id}` : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selected = notebooks?.find((n) => n.id === selectedId) ?? notebooks?.[0] ?? null;

  const create = async () => {
    if (!title.trim()) {
      toast("error", "Notebook title is required");
      return;
    }
    setSaving(true);
    try {
      const nb = await api<Notebook>("/api/notebooks", { body: { title, description, workspaceId: ws?.id } });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setSelectedId(nb.id);
      mutate();
      toast("success", "Notebook created");
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
      await api(`/api/notebooks/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSelectedId(null);
      mutate();
      toast("success", "Notebook deleted");
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
        title="Notebook"
        description={`Knowledge engines for ${ws?.name ?? "…"} — add sources, then generate summaries, podcast outlines, infographic specs, and repurposing plans. Exports are NotebookLM-compatible markdown; direct NotebookLM sync is not implemented.`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New notebook
          </Button>
        }
      />

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!notebooks && !error && <Spinner label="Loading notebooks…" />}
      {notebooks && notebooks.length === 0 && (
        <EmptyState
          title="No notebooks in this workspace"
          hint="A notebook is a topic-scoped knowledge engine: sources in, structured outputs out."
          action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Create notebook</Button>}
        />
      )}

      {notebooks && notebooks.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {notebooks.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
                  selected?.id === n.id
                    ? "border-indigo-glow/50 bg-indigo-glow/12 text-mist-100"
                    : "border-white/12 text-mist-400 hover:border-indigo-glow/30 hover:text-mist-100"
                }`}
              >
                {n.title}
              </button>
            ))}
          </div>
          {selected && <NotebookDetail notebook={selected} onChange={() => mutate()} onDelete={() => setDeleteTarget(selected)} />}
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New notebook">
        <div className="space-y-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI agents research" maxLength={200} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create notebook</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete notebook?"
        body={`"${deleteTarget?.title}" with ${deleteTarget?.sources.length ?? 0} source(s) and ${deleteTarget?.outputs.length ?? 0} output(s) will be removed. Vault notes created from it stay.`}
      />
    </div>
  );
}

function NotebookDetail({ notebook, onChange, onDelete }: { notebook: Notebook; onChange: () => void; onDelete: () => void }) {
  const { toast } = useToast();
  const [srcTitle, setSrcTitle] = useState("");
  const [srcKind, setSrcKind] = useState<"text" | "markdown" | "url">("text");
  const [srcContent, setSrcContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [viewOutput, setViewOutput] = useState<Notebook["outputs"][number] | null>(null);

  const addSource = async () => {
    if (!srcTitle.trim() || !srcContent.trim()) {
      toast("error", "Source title and content are required");
      return;
    }
    setAdding(true);
    try {
      await api(`/api/notebooks/${notebook.id}`, { method: "PATCH", body: { kind: srcKind, title: srcTitle, content: srcContent } });
      setSrcTitle("");
      setSrcContent("");
      onChange();
      toast("success", "Source added");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const generate = async (kind: string) => {
    setGenerating(kind);
    try {
      const res = await api<{ output: Notebook["outputs"][number] }>(`/api/notebooks/${notebook.id}/generate`, { body: { kind } });
      onChange();
      refresh("/api/memory", "/api/loop");
      setViewOutput(res.output);
      toast("success", `${kind} generated and queued for the Vault`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const exportMarkdown = () => {
    const md = [
      `# ${notebook.title}`,
      notebook.description,
      "",
      "## Sources",
      ...notebook.sources.map((s) => `### ${s.title}\n\n${s.content}`),
      "",
      "## Outputs",
      ...notebook.outputs.map((o) => `### ${o.kind} (${o.provider})\n\n${o.content}`),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${notebook.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("success", "Exported as NotebookLM-compatible markdown");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Sources (${notebook.sources.length})`}>
        <div className="mb-3 space-y-2">
          <div className="flex gap-2">
            <Input value={srcTitle} onChange={(e) => setSrcTitle(e.target.value)} placeholder="Source title" />
            <Select value={srcKind} onChange={(e) => setSrcKind(e.target.value as typeof srcKind)} className="w-32" aria-label="Source kind">
              <option value="text">Text</option>
              <option value="markdown">Markdown</option>
              <option value="url">URL notes</option>
            </Select>
          </div>
          <Textarea value={srcContent} onChange={(e) => setSrcContent(e.target.value)} rows={4} placeholder="Paste the source content (transcript, article, notes)…" />
          <div className="flex justify-end">
            <Button size="sm" onClick={addSource} loading={adding} icon={Plus}>
              Add source
            </Button>
          </div>
        </div>
        {notebook.sources.length === 0 ? (
          <p className="text-xs text-mist-500">No sources yet — outputs are only generated from what you add here.</p>
        ) : (
          <ul className="space-y-1.5">
            {notebook.sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-1.5">
                <Badge status="idle">{s.kind}</Badge>
                <span className="min-w-0 flex-1 truncate text-[13px] text-mist-200">{s.title}</span>
                <span className="font-mono text-[10px] text-mist-600">{s.content.length.toLocaleString()} chars</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  title="Remove source"
                  onClick={() => api(`/api/notebooks/${notebook.id}`, { method: "PATCH", body: { removeSourceId: s.id } }).then(onChange)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4">
        <Card
          title="Generate"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={FileDown} onClick={exportMarkdown}>
                Export .md
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete}>
                Delete
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {OUTPUT_KINDS.map((k) => (
              <Button key={k.id} icon={Sparkles} onClick={() => generate(k.id)} loading={generating === k.id} disabled={notebook.sources.length === 0}>
                {k.label}
              </Button>
            ))}
          </div>
          {notebook.sources.length === 0 && <p className="mt-2 text-[11px] text-mist-500">Add at least one source to enable generation.</p>}
        </Card>

        <Card title={`Outputs (${notebook.outputs.length})`}>
          {notebook.outputs.length === 0 ? (
            <p className="text-xs text-mist-500">Generated outputs appear here and are queued for the Vault.</p>
          ) : (
            <ul className="space-y-1.5">
              {notebook.outputs.map((o) => (
                <li key={o.id}>
                  <button onClick={() => setViewOutput(o)} className="flex w-full items-center gap-2 rounded-lg border border-white/8 px-2.5 py-2 text-left transition hover:border-indigo-glow/40">
                    <Badge status="idle">{o.kind}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-mist-400">{o.provider}</span>
                    <span className="font-mono text-[10px] text-mist-600">{timeAgo(o.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={!!viewOutput} onClose={() => setViewOutput(null)} title={viewOutput?.kind ?? ""} wide>
        {viewOutput && (
          <div className="inset max-h-[60vh] overflow-y-auto p-4">
            <Markdown>{viewOutput.content}</Markdown>
          </div>
        )}
      </Modal>
    </div>
  );
}
