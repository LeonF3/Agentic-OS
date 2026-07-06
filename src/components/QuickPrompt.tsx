"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Select, Textarea } from "./ui";
import Markdown from "./Markdown";
import { api, refresh } from "@/lib/useApi";
import { useToast } from "./toast";
import type { AgentRun } from "@/lib/schemas";

interface AgentLite {
  id: string;
  name: string;
  role: string;
}

/** The Mission Control prompt box — real runs, visible typing, honest output. */
export default function QuickPrompt({ agents }: { agents: AgentLite[] }) {
  const { toast } = useToast();
  const [agentId, setAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AgentRun | null>(null);

  const core = agents.find((a) => a.name === "Sebastian Core");
  const effectiveAgent = agentId || core?.id || agents[0]?.id || "";

  const run = async () => {
    if (!prompt.trim()) {
      toast("error", "Type a prompt first");
      return;
    }
    setRunning(true);
    setLastRun(null);
    try {
      const result = await api<AgentRun>(`/api/agents/${effectiveAgent}/run`, { body: { input: prompt } });
      setLastRun(result);
      setPrompt("");
      refresh("/api/runs", "/api/memory", "/api/loop", "/api/audit", "/api/agents");
      if (result.status === "failed") toast("error", result.error ?? "Run failed");
      else toast("success", `${agents.find((a) => a.id === effectiveAgent)?.name ?? "Agent"} completed the run`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={effectiveAgent} onChange={(e) => setAgentId(e.target.value)} className="sm:w-52" aria-label="Choose agent">
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
        }}
        placeholder="Ask anything, plan anything… (⌘⏎ to run)"
        rows={3}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-mist-500">
          Runs are recorded, routed through The Brain, and queued for the Vault.
        </p>
        <Button variant="primary" onClick={run} loading={running} icon={Send}>
          {running ? "Running…" : "Run"}
        </Button>
      </div>
      {lastRun && (
        <div className="inset max-h-80 overflow-y-auto p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-mist-500">
            <span className="font-mono">{lastRun.id}</span>
            <span>·</span>
            <span>{lastRun.model}</span>
            {lastRun.degraded && <span className="text-gold">· local adapter (no key)</span>}
          </div>
          <Markdown>{lastRun.output || lastRun.error || ""}</Markdown>
        </div>
      )}
    </div>
  );
}
