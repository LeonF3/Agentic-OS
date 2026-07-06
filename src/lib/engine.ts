import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import { listNotes } from "./vault";
import { runModel, getSettings } from "./modelrouter";
import type { Agent, AgentRun, MemoryWrite, RunLog, TaskType, Workspace } from "./schemas";

/**
 * Agent run engine.
 * Creates a real run record, builds memory context, routes the model call,
 * persists logs/output, queues the result for the memory Loop, and audits.
 */

function log(logs: RunLog[], level: RunLog["level"], message: string): void {
  logs.push({ at: nowIso(), level, message });
}

export async function executeAgentRun(opts: {
  agentId: string;
  workspaceId?: string;
  input: string;
  taskType?: TaskType;
  providerId?: string;
  title?: string;
}): Promise<AgentRun> {
  const [agents, workspaces, settings] = await Promise.all([
    readCollection<Agent>("agents"),
    readCollection<Workspace>("workspaces"),
    getSettings(),
  ]);
  const agent = agents.find((a) => a.id === opts.agentId);
  if (!agent) throw new Error("Agent not found");
  if (agent.status === "disabled") throw new Error(`${agent.name} is disabled — enable it in the agent's configuration.`);

  const workspaceId = opts.workspaceId || settings.activeWorkspaceId;
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) throw new Error("Workspace not found");
  if (agent.workspaceAccess.length > 0 && !agent.workspaceAccess.includes(workspaceId)) {
    throw new Error(`${agent.name} does not have access to workspace ${workspace.name}`);
  }

  const logs: RunLog[] = [];
  const title = opts.title?.trim() || opts.input.slice(0, 80).replace(/\s+/g, " ");
  const run: AgentRun = {
    id: newId("run"),
    workspaceId,
    agentId: agent.id,
    providerId: "pending",
    model: "pending",
    title,
    input: opts.input,
    output: "",
    status: "running",
    degraded: false,
    logs,
    toolCalls: [],
    artifacts: [],
    memoryWriteIds: [],
    startedAt: nowIso(),
    completedAt: null,
    error: null,
  };

  log(logs, "info", `Run created for ${agent.name} in workspace "${workspace.name}"`);
  await updateCollection<AgentRun>("runs", (items) => [run, ...items]);

  try {
    // Memory context: pinned + recent notes in scope.
    let memoryContext = "";
    if (agent.memoryScope !== "none") {
      const scopeWs = agent.memoryScope === "workspace" ? workspaceId : undefined;
      const pinned = await listNotes({ workspaceId: scopeWs, pinned: true });
      const recent = (await listNotes({ workspaceId: scopeWs })).slice(0, 5);
      const seen = new Set<string>();
      const ctxNotes = [...pinned, ...recent].filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))).slice(0, 8);
      if (ctxNotes.length > 0) {
        memoryContext =
          "\n\nWorkspace memory context (from the Vault):\n" +
          ctxNotes.map((n) => `- [${n.type}] ${n.title}: ${n.excerpt}`).join("\n");
        log(logs, "tool", `memory.read → attached ${ctxNotes.length} note(s) as context`);
        run.toolCalls.push("memory.read");
      }
    }

    const system = [
      agent.instructions || `You are ${agent.name}, ${agent.role}.`,
      `Active workspace: ${workspace.name} — ${workspace.description}`,
      "Answer in clean markdown. Be specific and practical.",
      memoryContext,
    ].join("\n");

    const taskType = opts.taskType ?? agent.modelRoute;
    log(logs, "info", `Routing task type "${taskType}" via The Brain`);
    const result = await runModel({ taskType, system, prompt: opts.input, providerOverride: opts.providerId });
    log(
      logs,
      "info",
      `${result.providerName} responded in ${result.durationMs}ms (model ${result.model})${result.degraded ? " — degraded to local adapter" : ""}`
    );

    run.output = result.output;
    run.providerId = result.providerId;
    run.model = result.model;
    run.degraded = result.degraded;
    run.status = "complete";
    run.completedAt = nowIso();

    // Queue the output for the Loop → Vault.
    const mw: MemoryWrite = {
      id: newId("queue"),
      workspaceId,
      title: `${agent.name}: ${title}`,
      type: "Agent Run",
      markdown: [
        `**Agent:** ${agent.name}  `,
        `**Provider:** ${result.providerName} (\`${result.model}\`)  `,
        `**Run:** ${run.id}`,
        "",
        "## Prompt",
        opts.input,
        "",
        "## Output",
        result.output,
      ].join("\n"),
      tags: ["agent-run", agent.name.toLowerCase().replace(/\s+/g, "-")],
      sourceType: "agent_run",
      sourceId: run.id,
      status: settings.autoWriteRunLogs ? "auto" : "pending",
      error: null,
      noteId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await updateCollection<MemoryWrite>("memory-queue", (items) => [mw, ...items]);
    run.memoryWriteIds.push(mw.id);
    log(logs, "tool", `memory.write → queued "${mw.title}" (${mw.status})`);
    run.toolCalls.push("memory.write");
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : "Unknown error";
    run.completedAt = nowIso();
    log(logs, "error", run.error);
  }

  await updateCollection<AgentRun>("runs", (items) => items.map((r) => (r.id === run.id ? run : r)));
  await audit({
    workspaceId,
    actorType: "agent",
    actorId: agent.id,
    action: run.status === "complete" ? "run.complete" : "run.failed",
    targetType: "run",
    targetId: run.id,
    details: `${agent.name} — ${title}`,
  });
  return run;
}
