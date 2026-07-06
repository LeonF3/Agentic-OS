"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Save } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Markdown from "@/components/Markdown";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Select, Spinner, Textarea } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { TASK_TYPES, type Agent, type AgentRun } from "@/lib/schemas";

export default function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const { data, error, mutate } = useApi<{ agent: Agent; runs: AgentRun[] }>(`/api/agents/${id}`, 15000);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);

  if (error) return <ErrorState message={error.message} retry={() => mutate()} />;
  if (!data) return <Spinner label="Loading agent…" />;

  const { agent, runs } = data;
  const effInstructions = instructions ?? agent.instructions;
  const effRoute = route ?? agent.modelRoute;
  const dirty = effInstructions !== agent.instructions || effRoute !== agent.modelRoute;

  const run = async () => {
    if (!prompt.trim()) {
      toast("error", "Type a task or prompt first");
      return;
    }
    setRunning(true);
    try {
      const result = await api<AgentRun>(`/api/agents/${id}/run`, { body: { input: prompt } });
      setPrompt("");
      setOpenRun(result.id);
      mutate();
      refresh("/api/runs", "/api/loop", "/api/audit", "/api/memory");
      if (result.status === "failed") toast("error", result.error ?? "Run failed");
      else toast("success", "Run complete — output queued for the Vault");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const saveConfig = async () => {
    setSavingCfg(true);
    try {
      await api(`/api/agents/${id}`, {
        method: "PATCH",
        body: { instructions: effInstructions, modelRoute: effRoute },
      });
      toast("success", "Agent configuration saved");
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingCfg(false);
    }
  };

  const toggleEnabled = async () => {
    try {
      await api(`/api/agents/${id}`, {
        method: "PATCH",
        body: { status: agent.status === "disabled" ? "idle" : "disabled" },
      });
      mutate();
      refresh("/api/agents");
      toast("info", agent.status === "disabled" ? `${agent.name} enabled` : `${agent.name} disabled`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/agents" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mist-500 hover:text-mist-100">
        <ArrowLeft size={13} /> Agent Roster
      </Link>
      <PageHeader
        script={agent.system ? "Core Agent" : "Field Agent"}
        title={agent.name}
        description={`${agent.role} — ${agent.description}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={agent.status} />
            <Button size="sm" onClick={toggleEnabled}>
              {agent.status === "disabled" ? "Enable" : "Disable"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title={`Run ${agent.name}`}>
            {agent.status === "disabled" ? (
              <EmptyState title={`${agent.name} is disabled`} hint="Enable the agent above to run it." />
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
                  }}
                  rows={4}
                  placeholder={`Give ${agent.name} a task… (⌘⏎ to run)`}
                />
                <div className="flex justify-end">
                  <Button variant="primary" icon={Play} onClick={run} loading={running}>
                    {running ? "Running…" : "Start run"}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Run history">
            {runs.length === 0 ? (
              <EmptyState title="No runs yet" hint="Every run is stored with logs, tool calls, model used, and output." />
            ) : (
              <ul className="space-y-2">
                {runs.map((r) => (
                  <li key={r.id} className="rounded-lg border border-white/8">
                    <button
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                      onClick={() => setOpenRun(openRun === r.id ? null : r.id)}
                      aria-expanded={openRun === r.id}
                    >
                      <Badge status={r.status} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-mist-200">{r.title}</span>
                      {r.degraded && <span className="text-[10px] text-gold">local</span>}
                      <span className="shrink-0 font-mono text-[10.5px] text-mist-500">{timeAgo(r.startedAt)}</span>
                    </button>
                    {openRun === r.id && (
                      <div className="space-y-3 border-t border-white/8 p-3">
                        <div className="text-[11px] text-mist-500">
                          <span className="font-mono">{r.id}</span> · model <span className="font-mono">{r.model}</span> · provider{" "}
                          <span className="font-mono">{r.providerId}</span>
                        </div>
                        <div className="inset p-3">
                          <div className="label mb-1.5">Timeline</div>
                          <ul className="space-y-1">
                            {r.logs.map((l, i) => (
                              <li key={i} className="flex gap-2 font-mono text-[11px]">
                                <span className="shrink-0 text-mist-600">{new Date(l.at).toLocaleTimeString()}</span>
                                <span className={l.level === "error" ? "text-nova-soft" : l.level === "tool" ? "text-cyan-glow" : "text-mist-400"}>
                                  {l.message}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {r.output && (
                          <div className="inset max-h-96 overflow-y-auto p-3">
                            <Markdown>{r.output}</Markdown>
                          </div>
                        )}
                        {r.error && <p className="text-xs text-nova-soft">{r.error}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Configuration">
            <div className="space-y-3">
              <Field label="Model route" hint="Which task type The Brain uses to pick a provider.">
                <Select value={effRoute} onChange={(e) => setRoute(e.target.value)}>
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Instructions">
                <Textarea value={effInstructions} onChange={(e) => setInstructions(e.target.value)} rows={6} />
              </Field>
              <Button variant="primary" size="sm" icon={Save} onClick={saveConfig} loading={savingCfg} disabled={!dirty}>
                Save configuration
              </Button>
            </div>
          </Card>

          <Card title="Capabilities">
            <div className="space-y-3 text-[12.5px]">
              <div>
                <div className="label mb-1">Tools</div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.length ? (
                    agent.tools.map((t) => (
                      <span key={t} className="rounded-md border border-white/12 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-mist-300">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-mist-500">No tools — pure reasoning agent</span>
                  )}
                </div>
              </div>
              <div>
                <div className="label mb-1">Permissions</div>
                <p className="text-mist-400">{agent.permissions.join(", ") || "read-only"}</p>
              </div>
              <div>
                <div className="label mb-1">Memory scope</div>
                <p className="text-mist-400">{agent.memoryScope}</p>
              </div>
              <div>
                <div className="label mb-1">Workspace access</div>
                <p className="text-mist-400">{agent.workspaceAccess.length ? `${agent.workspaceAccess.length} workspace(s)` : "All workspaces"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
