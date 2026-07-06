"use client";

import { useState } from "react";
import { Plug, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, ErrorState, Select, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { TASK_TYPES, type AgentRun, type Provider, type TaskType } from "@/lib/schemas";

type ProviderRow = Provider & { configured: boolean; recentCalls: number };

export default function BrainPage() {
  const { toast } = useToast();
  const { data, error, mutate } = useApi<{ providers: ProviderRow[]; routingRules: Record<TaskType, string> }>("/api/providers");
  const { data: runs } = useApi<AgentRun[]>("/api/runs?limit=8", 20000);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; latencyMs: number }>>({});
  const [savingRules, setSavingRules] = useState(false);
  const [rules, setRules] = useState<Record<TaskType, string> | null>(null);

  if (error) return <ErrorState message={error.message} retry={() => mutate()} />;
  if (!data) return <Spinner label="Waking The Brain…" />;

  const effRules = rules ?? data.routingRules;
  const dirty = rules && JSON.stringify(rules) !== JSON.stringify(data.routingRules);

  const test = async (providerId: string) => {
    setTesting(providerId);
    try {
      const result = await api<{ ok: boolean; message: string; latencyMs: number }>("/api/providers/test", { body: { providerId } });
      setTestResults((r) => ({ ...r, [providerId]: result }));
      toast(result.ok ? "success" : "error", result.message);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  const saveRules = async () => {
    if (!rules) return;
    setSavingRules(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { routingRules: rules } });
      toast("success", "Routing rules saved");
      setRules(null);
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        script="Layer III"
        title="The Brain"
        description="Model routing. The model is the engine; the OS is the vehicle — swap engines without changing the car. Keys live in .env.local and are never shown or stored here."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {data.providers.map((p) => {
            const t = testResults[p.id];
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-mist-100">{p.name}</h3>
                      <Badge status={p.configured ? "ok" : p.kind === "local" ? "active" : "pending"}>
                        {p.kind === "local" ? "always on" : p.configured ? "key found" : "no key"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12.5px] text-mist-400">{p.note}</p>
                    <p className="mt-1.5 font-mono text-[11px] text-mist-500">
                      model: {p.defaultModel}
                      {p.envKey && <> · env: {p.envKey}</>}
                      {" · "}
                      {p.recentCalls} call(s) logged
                    </p>
                    {!p.configured && p.kind !== "local" && (
                      <p className="mt-1.5 text-[11.5px] text-gold">
                        Add <span className="font-mono">{p.envKey}</span> to <span className="font-mono">.env.local</span> and restart to enable.
                      </p>
                    )}
                    {t && (
                      <p className={`mt-1.5 text-[11.5px] ${t.ok ? "text-aurora" : "text-nova-soft"}`}>
                        {t.ok ? `Connected in ${t.latencyMs}ms` : t.message}
                      </p>
                    )}
                  </div>
                  <Button size="sm" icon={Plug} onClick={() => test(p.id)} loading={testing === p.id}>
                    Test
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card
            title="Routing rules"
            action={
              dirty ? (
                <Button size="sm" variant="primary" onClick={saveRules} loading={savingRules}>
                  Save rules
                </Button>
              ) : undefined
            }
          >
            <p className="mb-3 text-xs text-mist-500">
              Which provider handles each task type. If the chosen provider has no key, The Brain falls back to any configured
              provider, then to the Local Dev Adapter — output is always labeled with what actually ran.
            </p>
            <div className="space-y-2.5">
              {TASK_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 font-mono text-[12px] text-mist-300">{t}</span>
                  <Select
                    value={effRules[t] ?? "openrouter"}
                    onChange={(e) => setRules({ ...effRules, [t]: e.target.value })}
                    aria-label={`Provider for ${t}`}
                  >
                    {data.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {!p.configured && p.kind !== "local" ? " (no key)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recent model calls">
            {!runs ? (
              <Spinner />
            ) : runs.length === 0 ? (
              <p className="text-xs text-mist-500">No calls yet — run any agent and it shows up here with the model used.</p>
            ) : (
              <ul className="space-y-1.5">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5 text-[12px]">
                    <Zap size={11} className={r.degraded ? "text-gold" : "text-cyan-glow"} />
                    <span className="font-mono text-mist-300">{r.model}</span>
                    <span className="min-w-0 flex-1 truncate text-mist-500">{r.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-mist-600">{timeAgo(r.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Cost & safety">
            <p className="text-xs leading-relaxed text-mist-500">
              Paid providers bill per call — routing reasoning/long-context work to paid models can add up. The Local Dev Adapter is free
              and offline. Keys are read from the environment only; the UI shows configured/missing status, never the key itself.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
