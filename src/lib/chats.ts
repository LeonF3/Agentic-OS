import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { executeAgentRun } from "./engine";
import type { AgentRun, ChatSession } from "./schemas";

/**
 * Chat session layer — real multi-turn conversations.
 * Each session groups AgentRuns; continue appends a run with full history sent to the model.
 */

let migrated = false;

/** Wrap orphan runs (no sessionId) into one-message sessions. Idempotent. */
export async function migrateOrphanRuns(): Promise<void> {
  if (migrated) return;

  const runs = await readCollection<AgentRun>("runs");
  const orphanRuns = runs.filter((r) => !r.sessionId);
  if (orphanRuns.length === 0) {
    migrated = true;
    return;
  }

  const newSessions: ChatSession[] = [];

  for (const run of orphanRuns) {
    const sessionId = newId("chat");
    const title = run.input.slice(0, 80).replace(/\s+/g, " ").trim() || run.title;
    newSessions.push({
      id: sessionId,
      workspaceId: run.workspaceId,
      agentId: run.agentId,
      title,
      createdAt: run.startedAt,
      updatedAt: run.completedAt ?? run.startedAt,
    });
    run.sessionId = sessionId;
  }

  await updateCollection<ChatSession>("chat-sessions", (items) => [...newSessions, ...items]);
  await updateCollection<AgentRun>("runs", (items) =>
    items.map((r) => {
      const orphan = orphanRuns.find((o) => o.id === r.id);
      return orphan ? { ...r, sessionId: orphan.sessionId } : r;
    })
  );
  migrated = true;
}

export async function listChatSessions(workspaceId?: string, limit = 100): Promise<ChatSession[]> {
  await migrateOrphanRuns();
  let sessions = await readCollection<ChatSession>("chat-sessions");
  if (workspaceId) sessions = sessions.filter((s) => s.workspaceId === workspaceId);
  return sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, limit);
}

export async function getChatSession(
  sessionId: string
): Promise<{ session: ChatSession; runs: AgentRun[] } | null> {
  await migrateOrphanRuns();
  const sessions = await readCollection<ChatSession>("chat-sessions");
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const runs = (await readCollection<AgentRun>("runs"))
    .filter((r) => r.sessionId === sessionId)
    .sort((a, b) => (a.startedAt > b.startedAt ? 1 : -1));

  return { session, runs };
}

export async function createChatSession(opts: {
  agentId: string;
  workspaceId?: string;
  input: string;
  skillIds?: string[];
}): Promise<{ session: ChatSession; run: AgentRun }> {
  await migrateOrphanRuns();

  const now = nowIso();
  const title = opts.input.slice(0, 80).replace(/\s+/g, " ").trim() || "New chat";
  const session: ChatSession = {
    id: newId("chat"),
    workspaceId: opts.workspaceId ?? "",
    agentId: opts.agentId,
    title,
    createdAt: now,
    updatedAt: now,
  };

  const run = await executeAgentRun({
    agentId: opts.agentId,
    workspaceId: opts.workspaceId,
    input: opts.input,
    sessionId: session.id,
    skillIds: opts.skillIds,
  });

  session.workspaceId = run.workspaceId;
  session.updatedAt = run.completedAt ?? run.startedAt;

  await updateCollection<ChatSession>("chat-sessions", (items) => [session, ...items]);
  return { session, run };
}

export async function continueChatSession(
  sessionId: string,
  input: string,
  skillIds?: string[]
): Promise<{ session: ChatSession; run: AgentRun }> {
  await migrateOrphanRuns();

  const detail = await getChatSession(sessionId);
  if (!detail) throw new Error("Chat session not found");

  const run = await executeAgentRun({
    agentId: detail.session.agentId,
    workspaceId: detail.session.workspaceId,
    input,
    sessionId,
    skillIds,
  });

  const updatedAt = run.completedAt ?? run.startedAt;
  await updateCollection<ChatSession>("chat-sessions", (items) =>
    items.map((s) => (s.id === sessionId ? { ...s, updatedAt } : s))
  );

  return {
    session: { ...detail.session, updatedAt },
    run,
  };
}
