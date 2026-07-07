"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Trash2, Upload, Wand2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button, Card, ConfirmDialog, EmptyState, Spinner } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import type { Skill, SkillWithWorkspace, Workspace } from "@/lib/schemas";

interface SkillCatalog {
  workspace: Skill[];
  other: SkillWithWorkspace[];
}

export default function SkillsPage() {
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data: catalog, mutate } = useApi<SkillCatalog>(ws ? `/api/skills?workspaceId=${ws.id}` : null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!ws) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("workspaceId", ws.id);
      const skill = await api<Skill>("/api/skills/upload", { formData: form });
      mutate();
      refresh("/api/skills");
      toast("success", `Skill /${skill.name} uploaded to ${ws.name}`);
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
      await api(`/api/skills/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      mutate();
      refresh("/api/skills");
      toast("success", `Deleted /${deleteTarget.name}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        script="Mind"
        title="Skills"
        description={
          ws
            ? `Upload Cursor-compatible SKILL.md files to ${ws.name}. Invoke with /name in Chats or attach skills from other workspaces.`
            : "Select a workspace to manage skills."
        }
        actions={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <Button icon={Upload} onClick={() => fileRef.current?.click()} loading={uploading} disabled={!ws}>
              Upload SKILL.md
            </Button>
          </div>
        }
      />

      {!ws || !catalog ? (
        <Spinner label="Loading skills…" />
      ) : (
        <div className="space-y-4">
          <Card title={`Skills in ${ws.name}`}>
            {catalog.workspace.length === 0 ? (
              <EmptyState
                icon={Wand2}
                title="No skills in this workspace"
                hint="Upload a SKILL.md with frontmatter name (lowercase-hyphen) and description — same format as Cursor skills."
              />
            ) : (
              <ul className="divide-y divide-white/6">
                {catalog.workspace.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] text-indigo-soft">/{s.name}</div>
                      <p className="mt-0.5 text-[13px] text-mist-300">{s.description}</p>
                      <p className="mt-1 text-[11px] text-mist-500">Updated {timeAgo(s.updatedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href="/chats" className="text-xs text-mist-400 hover:text-mist-100">
                        Use in chat
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="text-mist-500 hover:text-nova-soft"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Slash commands">
            <ul className="space-y-2 text-[13px] text-mist-400">
              <li>
                <span className="font-mono text-indigo-soft">/skill-name</span> — skill in the active workspace
              </li>
              <li>
                <span className="font-mono text-indigo-soft">/workspace-slug/skill-name</span> — skill from another workspace
              </li>
              <li>Or attach cross-workspace skills from the picker in Chats without typing a slash path.</li>
            </ul>
          </Card>

          {catalog.other.length > 0 && (
            <Card title="Skills in other workspaces">
              <ul className="divide-y divide-white/6">
                {catalog.other.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <div className="font-mono text-[12px] text-indigo-soft">
                      /{s.workspaceSlug}/{s.name}
                    </div>
                    <div className="text-[11px] text-mist-500">{s.workspaceName}</div>
                    <p className="truncate text-[12px] text-mist-400">{s.description}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete skill?"
        body={deleteTarget ? `Remove /${deleteTarget.name} from this workspace?` : ""}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
