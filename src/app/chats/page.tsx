"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Plus, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Markdown from "@/components/Markdown";
import { Badge, Button, Card, EmptyState, Select, Spinner } from "@/components/ui";
import SkillCompose from "@/components/SkillCompose";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { timeAgo, truncate } from "@/lib/format";
import type { AgentRun, ChatSession, Workspace } from "@/lib/schemas";

interface AgentLite {
  id: string;
  name: string;
  status: string;
}

interface SessionDetail {
  session: ChatSession;
  runs: AgentRun[];
}

function ChatsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const wsQ = ws ? `?workspaceId=${ws.id}` : "";

  const { data: sessions, mutate: mutateSessions } = useApi<ChatSession[]>(
    ws ? `/api/chats${wsQ}&limit=100` : null,
    15000
  );
  const { data: agents } = useApi<AgentLite[]>("/api/agents");

  const sessionParam = searchParams.get("session");
  const runParam = searchParams.get("run");
  const [selectedId, setSelectedId] = useState<string | null>(sessionParam);
  const [composeMode, setComposeMode] = useState(!sessionParam && !runParam);

  const legacyRun = useApi<AgentRun>(runParam && !sessionParam ? `/api/runs/${runParam}` : null);

  const { data: detail, mutate: mutateDetail } = useApi<SessionDetail>(
    selectedId && !composeMode ? `/api/chats/${selectedId}` : null,
    10000
  );

  const [agentId, setAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const agentMap = useMemo(() => new Map((agents ?? []).map((a) => [a.id, a])), [agents]);
  const enabledAgents = (agents ?? []).filter((a) => a.status !== "disabled");
  const core = enabledAgents.find((a) => a.name === "Sebastian Core");
  const effectiveAgent = agentId || core?.id || enabledAgents[0]?.id || "";

  useEffect(() => {
    if (sessionParam) {
      setSelectedId(sessionParam);
      setComposeMode(false);
    }
  }, [sessionParam]);

  useEffect(() => {
    const sid = legacyRun.data?.sessionId;
    if (runParam && sid && !sessionParam) {
      router.replace(`/chats?session=${sid}`, { scroll: false });
    }
  }, [legacyRun.data, runParam, sessionParam, router]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.runs.length, running]);

  const selectSession = (id: string) => {
    setSelectedId(id);
    setComposeMode(false);
    setPrompt("");
    setSelectedSkillIds([]);
    router.replace(`/chats?session=${id}`, { scroll: false });
  };

  const startNew = () => {
    setSelectedId(null);
    setComposeMode(true);
    setPrompt("");
    setSelectedSkillIds([]);
    router.replace("/chats", { scroll: false });
  };

  const sendNew = async () => {
    if (!prompt.trim()) {
      toast("error", "Type a message first");
      return;
    }
    if (!effectiveAgent) {
      toast("error", "No agent available");
      return;
    }
    setRunning(true);
    try {
      const result = await api<{ session: ChatSession; run: AgentRun }>("/api/chats", {
        body: {
          agentId: effectiveAgent,
          input: prompt,
          workspaceId: ws?.id,
          skillIds: selectedSkillIds.length ? selectedSkillIds : undefined,
        },
      });
      setPrompt("");
      setSelectedSkillIds([]);
      setSelectedId(result.session.id);
      setComposeMode(false);
      mutateSessions();
      refresh("/api/runs", "/api/memory", "/api/loop", "/api/audit", "/api/agents", "/api/chats");
      router.replace(`/chats?session=${result.session.id}`, { scroll: false });
      if (result.run.status === "failed") toast("error", result.run.error ?? "Run failed");
      else toast("success", "Chat started");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Send failed");
    } finally {
      setRunning(false);
    }
  };

  const sendContinue = async () => {
    if (!prompt.trim() || !selectedId) {
      toast("error", "Type a message first");
      return;
    }
    setRunning(true);
    try {
      const result = await api<{ session: ChatSession; run: AgentRun }>(`/api/chats/${selectedId}/messages`, {
        body: {
          input: prompt,
          skillIds: selectedSkillIds.length ? selectedSkillIds : undefined,
        },
      });
      setPrompt("");
      setSelectedSkillIds([]);
      mutateDetail();
      mutateSessions();
      refresh("/api/runs", "/api/memory", "/api/loop", "/api/audit", "/api/chats");
      if (result.run.status === "failed") toast("error", result.run.error ?? "Run failed");
      else toast("success", "Message sent");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Send failed");
    } finally {
      setRunning(false);
    }
  };

  const sortedSessions = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [sessions]
  );

  const session = detail?.session;
  const runs = detail?.runs ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        script="Command"
        title="Chats"
        description={
          ws
            ? `Conversations in ${ws.name}. Each session keeps full history — pick one to continue.`
            : "Pick a workspace to see your chats."
        }
      />

      {!ws || !sessions || !agents ? (
        <Spinner label="Loading chats…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <button
              onClick={startNew}
              className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition ${
                composeMode
                  ? "border-indigo-glow/40 bg-indigo-glow/12 text-mist-100"
                  : "border-indigo-glow/30 bg-indigo-glow/8 text-indigo-soft hover:bg-indigo-glow/14"
              }`}
            >
              <Plus size={15} />
              New chat
            </button>

            {sortedSessions.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-mist-500">No sessions yet in this workspace.</p>
            ) : (
              <ul className="max-h-[calc(100dvh-16rem)] space-y-1 overflow-y-auto">
                {sortedSessions.map((s) => {
                  const agent = agentMap.get(s.agentId);
                  const active = !composeMode && selectedId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => selectSession(s.id)}
                        className={`flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
                          active
                            ? "border-indigo-glow/40 bg-indigo-glow/12"
                            : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate text-[13px] text-mist-100">{truncate(s.title, 60)}</span>
                        <span className="flex items-center gap-2 text-[11px] text-mist-500">
                          <span className="truncate">{agent?.name ?? "Agent"}</span>
                          <span>·</span>
                          <span className="shrink-0">{timeAgo(s.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3">
            {composeMode ? (
              <Card title="New chat">
                {enabledAgents.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No agents available"
                    hint="Enable an agent on the Agent Roster."
                  />
                ) : (
                  <div className="space-y-3">
                    <Select value={effectiveAgent} onChange={(e) => setAgentId(e.target.value)} aria-label="Choose agent">
                      {enabledAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    <SkillCompose
                      workspaceId={ws?.id}
                      value={prompt}
                      onChange={setPrompt}
                      selectedSkillIds={selectedSkillIds}
                      onSelectedSkillIdsChange={setSelectedSkillIds}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendNew();
                      }}
                      rows={5}
                      placeholder="Start a new conversation… Type / for skills (⌘⏎ to send)"
                      autoFocus
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-mist-500">
                        Use /skill-name in this workspace or attach skills from other workspaces below.
                      </p>
                      <Button variant="primary" onClick={sendNew} loading={running} icon={Send}>
                        {running ? "Running…" : "Send"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : !selectedId || !session ? (
              <Card title="Select a session">
                <EmptyState
                  icon={MessageSquare}
                  title="Pick a session or start a new chat"
                  hint="Sessions keep the full conversation. You can continue any thread from where you left off."
                />
              </Card>
            ) : !detail ? (
              <Spinner label="Loading session…" />
            ) : (
              <Card
                title={truncate(session.title, 80)}
                action={
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/agents/${session.agentId}`}
                      className="text-xs text-indigo-soft hover:underline"
                    >
                      {agentMap.get(session.agentId)?.name ?? "Agent"}
                    </Link>
                  </div>
                }
              >
                <div className="flex max-h-[calc(100dvh-14rem)] flex-col">
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {runs.length === 0 ? (
                      <p className="text-[13px] text-mist-500">No messages yet.</p>
                    ) : (
                      runs.map((r) => (
                        <div key={r.id} className="space-y-2">
                          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
                            <div className="label mb-1.5">You</div>
                            <p className="whitespace-pre-wrap text-[13px] text-mist-200">{r.input}</p>
                          </div>
                          {r.output ? (
                            <div className="inset p-3">
                              <div className="mb-1.5 flex items-center gap-2">
                                <div className="label">Response</div>
                                <Badge status={r.status} />
                                {r.degraded && <span className="text-[10px] text-gold">local</span>}
                              </div>
                              <Markdown>{r.output}</Markdown>
                            </div>
                          ) : r.status === "running" || r.status === "queued" ? (
                            <Spinner label="Agent is thinking…" />
                          ) : r.error ? (
                            <p className="text-sm text-nova-soft">{r.error}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                    <div ref={threadEndRef} />
                  </div>

                  <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
                    <SkillCompose
                      workspaceId={ws?.id}
                      value={prompt}
                      onChange={setPrompt}
                      selectedSkillIds={selectedSkillIds}
                      onSelectedSkillIdsChange={setSelectedSkillIds}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendContinue();
                      }}
                      rows={3}
                      placeholder="Continue… /skill-name or attach cross-workspace skills (⌘⏎ to send)"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-mist-500">
                        {runs.length} message{runs.length === 1 ? "" : "s"} · agent sees full thread history
                      </p>
                      <Button variant="primary" onClick={sendContinue} loading={running} icon={Send}>
                        {running ? "Running…" : "Send"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading chats…" />}>
      <ChatsContent />
    </Suspense>
  );
}
