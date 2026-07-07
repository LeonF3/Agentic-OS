import fs from "node:fs";
import { collectionFile } from "./paths";
import { readCollection, writeCollection, readDoc, writeDoc } from "./store";
import { newId, nowIso, slugify } from "./ids";
import { SettingsSchema } from "./schemas";
import type { Agent, Goal, Provider, Settings, TaskCard, Workspace } from "./schemas";
import { createNote } from "./vault";

/**
 * First-run seeding. Idempotent: only fills collections that are empty.
 * Everything seeded here is real, editable data — no fake counters.
 */

const WORKSPACE_DEFS = [
  { name: "Leon HQ", description: "Personal headquarters — the master workspace.", color: "#7C8CF8", icon: "crown" },
  { name: "Quit 9-5", description: "Escape-velocity projects: freelance, products, income streams.", color: "#67E8F9", icon: "rocket" },
  { name: "Chosn", description: "Chosn product and engineering work.", color: "#A78BFA", icon: "gem" },
  { name: "Starfish", description: "Starfish client and business work.", color: "#E879A0", icon: "star" },
  { name: "Personal", description: "Life admin, health, private notes.", color: "#8BF0B0", icon: "heart" },
];

const AGENT_DEFS: Array<Omit<Agent, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "Sebastian Core",
    role: "Main assistant",
    description: "The voice of the OS. Default assistant for quick prompts from Mission Control.",
    icon: "sparkles",
    color: "#7C8CF8",
    system: true,
    modelRoute: "chat",
    tools: ["memory.read", "memory.write"],
    permissions: ["read", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are Sebastian Core, the main assistant of Sebastian's Wonderland OS. Be concise, practical, and calm. Always ground answers in workspace memory context when provided.",
  },
  {
    name: "Hermes",
    role: "Conductor / orchestrator",
    description: "Kanban, skills, plugins, tool calls, work routing, multi-agent coordination.",
    icon: "waypoints",
    color: "#AAB6FF",
    system: false,
    modelRoute: "reasoning",
    tools: ["kanban.create", "kanban.move", "agents.call", "memory.read", "memory.write"],
    permissions: ["read", "write-tasks", "write-memory", "call-agents"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are Hermes, the conductor. Break objectives into tasks, propose kanban cards (as a markdown checklist), route work to the right agent, and summarize progress.",
  },
  {
    name: "OpenClaw",
    role: "Keeper of creations",
    description: "Local-first always-on assistant for Workspace, Studio, and the Control Room.",
    icon: "shell",
    color: "#67E8F9",
    system: false,
    modelRoute: "chat",
    tools: ["studio.save", "workspace.organize", "memory.read", "memory.write"],
    permissions: ["read", "write-assets", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are OpenClaw, keeper of creations. Capture ideas, organize creative artifacts into workspace buckets, and never lose an output.",
  },
  {
    name: "Codex",
    role: "Coding & automation",
    description: "Code review, implementation planning, long-horizon goal mode for engineering work.",
    icon: "code-2",
    color: "#8BF0B0",
    system: false,
    modelRoute: "coding",
    tools: ["terminal.run", "files.read", "memory.read", "memory.write"],
    permissions: ["read", "run-terminal", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are Codex, the coding agent. Produce implementation plans, review code, and structure engineering work into small verifiable steps.",
  },
  {
    name: "Antigravity",
    role: "Long-context analyst",
    description: "Gemini-style adapter for large documents, transcripts, and long-context planning.",
    icon: "orbit",
    color: "#C4B5FD",
    system: false,
    modelRoute: "long-context",
    tools: ["memory.read", "memory.write"],
    permissions: ["read", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are Antigravity, the long-context analyst. Digest large inputs, extract structure, and index the essentials back into memory.",
  },
  {
    name: "Free Claude Code",
    role: "Sovereign coding harness",
    description: "Claude-Code-style workflows routed to any configured model — no lock-in.",
    icon: "terminal",
    color: "#F3A8C4",
    system: false,
    modelRoute: "coding",
    tools: ["terminal.run", "files.read", "memory.read", "memory.write"],
    permissions: ["read", "run-terminal", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions:
      "You are a project-aware coding harness. Plan multi-file changes, propose diffs as markdown, and keep a tight review loop.",
  },
  {
    name: "Router Agent",
    role: "Model & tool routing",
    description: "Chooses the model, agent, and tools for each task based on routing rules.",
    icon: "git-branch",
    color: "#AAB6FF",
    system: true,
    modelRoute: "chat",
    tools: [],
    permissions: ["read"],
    workspaceAccess: [],
    memoryScope: "none",
    status: "idle",
    instructions: "You are the Router. Given a task, recommend the best task-type route and explain why in one line.",
  },
  {
    name: "Memory Librarian",
    role: "Vault organization",
    description: "Organizes notes, tags, backlinks, and summaries. Reviews the memory write queue.",
    icon: "library",
    color: "#A78BFA",
    system: true,
    modelRoute: "chat",
    tools: ["memory.read", "memory.write"],
    permissions: ["read", "write-memory"],
    workspaceAccess: [],
    memoryScope: "global",
    status: "idle",
    instructions: "You are the Memory Librarian. Suggest tags, backlinks, and PARA placement for notes.",
  },
  {
    name: "QA Agent",
    role: "Workflow testing",
    description: "Tests workflows and reports bugs into the kanban.",
    icon: "bug",
    color: "#E879A0",
    system: true,
    modelRoute: "reasoning",
    tools: ["kanban.create", "memory.read"],
    permissions: ["read", "write-tasks"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions: "You are the QA agent. Given a feature description, produce a test checklist and likely failure modes.",
  },
  {
    name: "UX Auditor",
    role: "Usability review",
    description: "Reviews screens and flows for usability issues.",
    icon: "eye",
    color: "#67E8F9",
    system: true,
    modelRoute: "reasoning",
    tools: ["memory.read", "memory.write"],
    permissions: ["read", "write-memory"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions: "You are the UX auditor. Evaluate flows for clarity, contrast, feedback states, and dead ends.",
  },
  {
    name: "Security Agent",
    role: "Secrets & permissions",
    description: "Checks secrets handling, permissions, and risky actions.",
    icon: "shield",
    color: "#F3A8C4",
    system: true,
    modelRoute: "reasoning",
    tools: ["memory.read"],
    permissions: ["read"],
    workspaceAccess: [],
    memoryScope: "none",
    status: "idle",
    instructions: "You are the Security agent. Flag secret exposure, destructive actions, and boundary violations.",
  },
  {
    name: "Workspace Concierge",
    role: "Workspace separation",
    description: "Keeps each workspace separated and organized.",
    icon: "folder-kanban",
    color: "#8BF0B0",
    system: true,
    modelRoute: "chat",
    tools: ["workspace.organize", "memory.read"],
    permissions: ["read"],
    workspaceAccess: [],
    memoryScope: "workspace",
    status: "idle",
    instructions: "You are the Workspace Concierge. Keep outputs in the right workspace and flag cross-contamination.",
  },
  {
    name: "Loop Agent",
    role: "The Loop",
    description: "Writes outputs back into memory and schedules indexing.",
    icon: "refresh-cw",
    color: "#7C8CF8",
    system: true,
    modelRoute: "chat",
    tools: ["memory.write", "loop.run"],
    permissions: ["write-memory"],
    workspaceAccess: [],
    memoryScope: "global",
    status: "idle",
    instructions: "You are the Loop agent. Convert outputs into structured markdown notes and keep the index fresh.",
  },
];

const PROVIDER_DEFS: Array<Omit<Provider, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "OpenRouter (Owl Alpha & free models)",
    kind: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "openrouter/auto",
    defaultFor: ["chat", "research"],
    note: "Default everyday brain. Free/low-cost models via one key.",
  },
  {
    name: "Anthropic Claude",
    kind: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    defaultFor: ["reasoning"],
    note: "Reasoning-heavy plans, long-form planning, code review.",
  },
  {
    name: "OpenAI",
    kind: "openai",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    defaultFor: ["coding"],
    note: "Coding and automation workflows.",
  },
  {
    name: "Google Gemini",
    kind: "gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    defaultFor: ["long-context"],
    note: "Long-context jobs: big files, transcripts, codebases.",
  },
  {
    name: "xAI Grok",
    kind: "xai",
    envKey: "XAI_API_KEY",
    defaultModel: "grok-3-mini",
    defaultFor: ["multimodal"],
    note: "Multimodal / search workflows for the Studio.",
  },
  {
    name: "Local Dev Adapter",
    kind: "local",
    envKey: "",
    defaultModel: "local-dev",
    defaultFor: [],
    note: "Offline deterministic adapter. Always available; clearly labeled on every output.",
  },
];

export interface Db {
  workspaces: Workspace[];
  settings: Settings;
}

let seededThisProcess = false;

/**
 * Serialized via a globalThis promise so concurrent first requests can't
 * each generate their own workspace ids (which would orphan the settings,
 * tasks, and goals that reference the losing set).
 */
export async function ensureSeeded(): Promise<void> {
  const g = globalThis as { __swosSeedLock?: Promise<void> };
  if (!g.__swosSeedLock) {
    g.__swosSeedLock = Promise.resolve();
  }
  const run = g.__swosSeedLock.then(() => seedOnce());
  g.__swosSeedLock = run.catch(() => undefined);
  return run;
}

async function seedOnce(): Promise<void> {
  if (seededThisProcess && fs.existsSync(collectionFile("workspaces"))) return;

  const now = nowIso();

  let workspaces = await readCollection<Workspace>("workspaces");
  if (workspaces.length === 0) {
    workspaces = WORKSPACE_DEFS.map((w) => ({
      id: newId("workspace"),
      name: w.name,
      slug: slugify(w.name),
      description: w.description,
      color: w.color,
      icon: w.icon,
      createdAt: now,
      updatedAt: now,
    }));
    await writeCollection("workspaces", workspaces);
  }

  const hq = workspaces.find((w) => w.slug === "leon-hq") ?? workspaces[0];

  const agents = await readCollection<Agent>("agents");
  if (agents.length === 0) {
    await writeCollection(
      "agents",
      AGENT_DEFS.map((a) => ({ ...a, id: newId("agent"), createdAt: now, updatedAt: now }))
    );
  }

  const providers = await readCollection<Provider>("providers");
  if (providers.length === 0) {
    await writeCollection(
      "providers",
      PROVIDER_DEFS.map((p) => ({
        ...p,
        id: p.kind === "local" ? "local-dev" : p.kind,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  const settings = await readDoc<Settings | null>("settings", null);
  if (!settings || !settings.activeWorkspaceId) {
    await writeDoc("settings", SettingsSchema.parse({ activeWorkspaceId: hq.id }));
  }

  const tasks = await readCollection<TaskCard>("tasks");
  if (tasks.length === 0 && hq) {
    const starter: TaskCard[] = [
      {
        id: newId("task"),
        workspaceId: hq.id,
        title: "Tour Mission Control",
        description:
          "Starter card (editable/deletable). Walk each screen: Agents, Memory, Kanban, Goals, Studio, Brain, Health.",
        column: "triage",
        order: 0,
        priority: "medium",
        assignedAgentId: null,
        linkedGoalId: null,
        linkedMilestoneIndex: null,
        linkedNoteIds: [],
        checklist: [
          { text: "Run a quick prompt from Mission Control", done: false },
          { text: "Create a memory note", done: false },
          { text: "Run the Loop once", done: false },
        ],
        comments: [],
        dueDate: null,
        seeded: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: newId("task"),
        workspaceId: hq.id,
        title: "Connect a model provider",
        description:
          "Starter card (editable/deletable). Add an OpenRouter or Anthropic key to .env.local, then test the connection in The Brain.",
        column: "outline",
        order: 0,
        priority: "high",
        assignedAgentId: null,
        linkedGoalId: null,
        linkedMilestoneIndex: null,
        linkedNoteIds: [],
        checklist: [],
        comments: [],
        dueDate: null,
        seeded: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    await writeCollection("tasks", starter);
  }

  const goals = await readCollection<Goal>("goals");
  if (goals.length === 0 && hq) {
    await writeCollection<Goal>("goals", [
      {
        id: newId("goal"),
        workspaceId: hq.id,
        title: "Run SWOS daily for a week",
        objective:
          "Starter goal (editable/deletable). Use Mission Control every day: capture notes, run agents, let the Loop compound context.",
        constraints: "Local-first. No key required — the Local Dev Adapter covers offline runs.",
        priority: "high",
        assignedAgentIds: [],
        status: "active",
        milestones: [
          { text: "Day 1 — first agent run recorded", done: false },
          { text: "Day 3 — 10 memory notes in the vault", done: false },
          { text: "Day 7 — loop run with zero failed writes", done: false },
        ],
        progress: 0,
        seeded: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  // Welcome note — only when the vault index is empty.
  const vaultIndex = await readCollection<unknown>("vault-index");
  if (vaultIndex.length === 0 && hq) {
    await createNote({
      workspaceId: hq.id,
      workspaceSlug: hq.slug,
      title: "Welcome to the Vault",
      type: "System Log",
      para: "resources",
      tags: ["swos", "onboarding"],
      pinned: true,
      markdown: [
        "This is your memory layer — plain markdown, PARA-organized, Obsidian-compatible.",
        "",
        "- Notes live in `.swos-data/vault/<workspace>/{projects,areas,resources,archive}/`",
        "- Link notes with `[[Note Title]]` — backlinks are computed automatically.",
        "- Agent outputs arrive via the **Memory Write Queue** where you approve, edit, or reject them.",
        "- The **Loop** converts approved outputs into notes here and refreshes the search index.",
        "",
        "Every new chat starts smarter because this vault deepens.",
      ].join("\n"),
    });
  }

  seededThisProcess = true;
}
