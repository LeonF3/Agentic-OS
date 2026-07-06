"use client";

import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button, Card, ConfirmDialog, ErrorState, Field, Input, Modal, Spinner, Textarea, Toggle } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import type { Workspace } from "@/lib/schemas";

interface SettingsData {
  activeWorkspaceId: string;
  autoWriteRunLogs: boolean;
  terminalEnabled: boolean;
  vaultPath: string;
  dataPath: string;
  lastLoopRunAt: string | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, error, mutate } = useApi<SettingsData>("/api/settings");
  const { data: workspaces, mutate: mutateWs } = useApi<Workspace[]>("/api/workspaces");
  const [editWs, setEditWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingWs, setSavingWs] = useState(false);
  const [deleteWs, setDeleteWs] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (error) return <ErrorState message={error.message} retry={() => mutate()} />;
  if (!settings) return <Spinner label="Loading settings…" />;

  const patchSetting = async (body: Record<string, unknown>) => {
    try {
      await api("/api/settings", { method: "PATCH", body });
      mutate();
      toast("success", "Setting saved");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    }
  };

  const saveWorkspace = async () => {
    if (!editWs) return;
    setSavingWs(true);
    try {
      await api(`/api/workspaces/${editWs.id}`, { method: "PATCH", body: { name: editName, description: editDesc } });
      setEditWs(null);
      mutateWs();
      refresh("/api/workspaces");
      toast("success", "Workspace updated");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingWs(false);
    }
  };

  const removeWorkspace = async () => {
    if (!deleteWs) return;
    setDeleting(true);
    try {
      await api(`/api/workspaces/${deleteWs.id}`, { method: "DELETE" });
      setDeleteWs(null);
      mutateWs();
      refresh("/api");
      toast("success", `Workspace "${deleteWs.name}" deleted (vault files preserved on disk)`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        script="System"
        title="Settings"
        description="Runtime behavior, workspace management, and storage paths. Provider keys are configured in .env.local — see The Brain for status."
      />

      <div className="space-y-4">
        <Card title="Automation">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-mist-100">Auto-write agent run logs to the Vault</p>
                <p className="text-[11.5px] text-mist-500">
                  On: run records flow into memory on each Loop run. Off: every write waits in the review queue.
                </p>
              </div>
              <Toggle checked={settings.autoWriteRunLogs} onChange={(v) => patchSetting({ autoWriteRunLogs: v })} label="Auto-write run logs" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-mist-100">Terminal tool</p>
                <p className="text-[11.5px] text-mist-500">Guard-railed shell on the Terminal screen. Disable to lock it entirely.</p>
              </div>
              <Toggle checked={settings.terminalEnabled} onChange={(v) => patchSetting({ terminalEnabled: v })} label="Terminal enabled" />
            </div>
          </div>
        </Card>

        <Card title="Workspaces">
          <ul className="space-y-2">
            {(workspaces ?? []).map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-lg border border-white/8 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: w.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-mist-100">
                    {w.name}
                    {w.id === settings.activeWorkspaceId && <span className="ml-2 text-[10px] uppercase tracking-wide text-indigo-soft">active</span>}
                  </p>
                  {w.description && <p className="truncate text-[11.5px] text-mist-500">{w.description}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Pencil}
                  aria-label={`Edit ${w.name}`}
                  onClick={() => {
                    setEditWs(w);
                    setEditName(w.name);
                    setEditDesc(w.description);
                  }}
                />
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${w.name}`} onClick={() => setDeleteWs(w)} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-mist-500">Create workspaces from the switcher in the sidebar. Deleting a workspace keeps its vault files on disk.</p>
        </Card>

        <Card title="Storage">
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-mist-500">Data directory</dt>
              <dd className="truncate font-mono text-mist-300">{settings.dataPath}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mist-500">Vault (Obsidian-compatible)</dt>
              <dd className="truncate font-mono text-mist-300">{settings.vaultPath}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-mist-500">
            Everything is plain JSON + markdown — copy the folder to back up the entire OS. Override the location with{" "}
            <span className="font-mono">SWOS_DATA_DIR</span> in .env.local.
          </p>
        </Card>
      </div>

      <Modal open={!!editWs} onClose={() => setEditWs(null)} title={`Edit ${editWs?.name}`}>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Description">
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditWs(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveWorkspace} loading={savingWs}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteWs}
        onClose={() => setDeleteWs(null)}
        onConfirm={removeWorkspace}
        loading={deleting}
        title={`Delete workspace "${deleteWs?.name}"?`}
        body="Tasks, goals, runs, and assets in this workspace will no longer be reachable from the UI. Vault markdown files stay on disk. This cannot be undone from the UI."
      />
    </div>
  );
}
