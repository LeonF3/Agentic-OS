"use client";

import { useRef, useState } from "react";
import { Clapperboard, Plus, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { fileSize, timeAgo } from "@/lib/format";
import type { StudioAsset, Workspace } from "@/lib/schemas";

type ProviderRow = { id: string; name: string; kind: string; configured: boolean };

export default function StudioPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: assets, error, mutate } = useApi<StudioAsset[]>(ws ? `/api/studio?workspaceId=${ws.id}` : null);
  const { data: providersData } = useApi<{ providers: ProviderRow[] }>("/api/providers");

  const [promptOpen, setPromptOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [assetType, setAssetType] = useState<"image" | "video" | "audio" | "prompt">("image");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<StudioAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const multimodal = providersData?.providers.find((p) => p.kind === "xai");
  const multimodalReady = multimodal?.configured ?? false;

  const savePrompt = async () => {
    if (!title.trim() || !prompt.trim()) {
      toast("error", "Title and prompt are both required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/studio", { body: { title, prompt, type: assetType, workspaceId: ws?.id } });
      setPromptOpen(false);
      setTitle("");
      setPrompt("");
      mutate();
      refresh("/api/memory", "/api/loop", "/api/audit");
      toast("success", "Prompt package saved to the workspace bucket and queued for the Vault");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (ws) form.append("workspaceId", ws.id);
      await api("/api/studio/upload", { formData: form });
      mutate();
      refresh("/api/audit");
      toast("success", `Uploaded ${file.name}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/studio/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setPreview(null);
      mutate();
      toast("success", "Asset deleted");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const fileUrl = (a: StudioAsset) => (a.filePath ? `/api/files/${a.filePath}` : null);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Layer VI"
        title="Studio"
        description={`Creative cockpit for ${ws?.name ?? "…"} — draft prompt packages, upload media, and keep every output in a workspace bucket.`}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
              accept="image/*,video/*,audio/*,.pdf,.md,.txt,.html"
            />
            <Button icon={Upload} onClick={() => fileRef.current?.click()} loading={uploading}>
              Upload media
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setPromptOpen(true)}>
              New prompt
            </Button>
          </>
        }
      />

      {!multimodalReady && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3 text-[12.5px] text-gold">
          No multimodal provider connected — Studio works in draft mode: prompts and uploads are saved and indexed, but nothing is
          generated. Add <span className="font-mono">XAI_API_KEY</span> (or another provider) in <span className="font-mono">.env.local</span>{" "}
          and check The Brain to enable generation.
        </div>
      )}

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!assets && !error && <Spinner label="Loading assets…" />}
      {assets && assets.length === 0 && (
        <EmptyState
          icon={Clapperboard}
          title="No assets yet"
          hint="Draft a prompt package or upload media — images preview, video and audio play inline."
          action={<Button variant="primary" icon={Plus} onClick={() => setPromptOpen(true)}>Draft the first prompt</Button>}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(assets ?? []).map((a) => (
          <button key={a.id} onClick={() => setPreview(a)} className="panel panel-hover overflow-hidden text-left">
            {a.type === "image" && fileUrl(a) ? (
              <img src={fileUrl(a)!} alt={a.title} className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center bg-ink-950/40 font-mono text-[11px] uppercase tracking-widest text-mist-500">
                {a.type}
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-mist-100">{a.title}</span>
                <Badge status="idle">{a.provider === "prompt-package" ? "prompt" : a.type}</Badge>
              </div>
              <p className="mt-1 font-mono text-[10.5px] text-mist-500">
                {a.size ? `${fileSize(a.size)} · ` : ""}
                {timeAgo(a.createdAt)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Prompt drafting */}
      <Modal open={promptOpen} onClose={() => setPromptOpen(false)} title="New prompt package" wide>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hero image — midnight castle" maxLength={200} />
            </Field>
            <Field label="Target output">
              <Select value={assetType} onChange={(e) => setAssetType(e.target.value as typeof assetType)}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Voice / audio</option>
                <option value="prompt">Research / search</option>
              </Select>
            </Field>
          </div>
          <Field label="Prompt" hint="Saved locally with full fidelity — ready to paste into any generator, or auto-run once a provider is connected.">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} placeholder="Describe exactly what you want generated…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={savePrompt} loading={saving}>Save prompt package</Button>
          </div>
        </div>
      </Modal>

      {/* Asset preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""} wide>
        {preview && (
          <div className="space-y-4">
            {preview.type === "image" && fileUrl(preview) && (
              <img src={fileUrl(preview)!} alt={preview.title} className="max-h-[55vh] w-full rounded-lg object-contain" />
            )}
            {preview.type === "video" && fileUrl(preview) && (
              <video src={fileUrl(preview)!} controls className="max-h-[55vh] w-full rounded-lg" />
            )}
            {preview.type === "audio" && fileUrl(preview) && <audio src={fileUrl(preview)!} controls className="w-full" />}
            {preview.type === "document" && fileUrl(preview) && preview.mimeType === "application/pdf" && (
              <iframe src={fileUrl(preview)!} className="h-[55vh] w-full rounded-lg border border-white/10" title={preview.title} />
            )}
            {preview.type === "html" && fileUrl(preview) && (
              <iframe
                src={`${fileUrl(preview)!}?sandbox=1`}
                sandbox=""
                className="h-[55vh] w-full rounded-lg border border-white/10 bg-white"
                title={preview.title}
              />
            )}
            {preview.prompt && (
              <div className="inset p-3">
                <div className="label mb-1.5">Prompt</div>
                <p className="whitespace-pre-wrap text-[13px] text-mist-300">{preview.prompt}</p>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-mist-500">
              <span className="font-mono">
                {preview.bucket} · {preview.mimeType ?? "prompt package"} · {timeAgo(preview.createdAt)}
              </span>
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(preview)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete asset?"
        body={`"${deleteTarget?.title}" will be removed${deleteTarget?.filePath ? " and its file deleted from disk" : ""}.`}
      />
    </div>
  );
}
