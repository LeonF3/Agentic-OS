import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const TASK_TYPES = [
  "chat",
  "reasoning",
  "coding",
  "long-context",
  "multimodal",
  "research",
] as const;
export const TaskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const KANBAN_COLUMNS = [
  "triage",
  "outline",
  "draft",
  "visuals",
  "review",
  "publish",
  "index",
  "repurpose",
] as const;
export const KanbanColumnSchema = z.enum(KANBAN_COLUMNS);
export type KanbanColumn = z.infer<typeof KanbanColumnSchema>;

export const KANBAN_COLUMN_LABELS: Record<KanbanColumn, string> = {
  triage: "Inbox / Triage",
  outline: "Plan / Outline",
  draft: "Build / Draft",
  visuals: "Visuals / Assets",
  review: "Review / QA",
  publish: "Publish / Done",
  index: "Index / Memory",
  repurpose: "Repurpose / Next",
};

export const NOTE_TYPES = [
  "Person",
  "Project",
  "Client",
  "Workspace",
  "Goal",
  "Task",
  "Agent Run",
  "Decision",
  "Meeting",
  "Research",
  "Content Output",
  "Code Change",
  "Asset",
  "Reflection",
  "System Log",
] as const;
export const NoteTypeSchema = z.enum(NOTE_TYPES);
export type NoteType = z.infer<typeof NoteTypeSchema>;

export const BUCKETS = [
  "chats",
  "agent-runs",
  "notes",
  "tasks",
  "goals",
  "documents",
  "code",
  "images",
  "video",
  "audio",
  "research",
  "seo-content",
  "exports",
] as const;
export const BucketSchema = z.enum(BUCKETS);
export type Bucket = z.infer<typeof BucketSchema>;

export const BUCKET_LABELS: Record<Bucket, string> = {
  chats: "Chats",
  "agent-runs": "Agent Runs",
  notes: "Notes",
  tasks: "Tasks",
  goals: "Goals",
  documents: "Documents",
  code: "Code",
  images: "Images",
  video: "Video",
  audio: "Audio",
  research: "Research",
  "seo-content": "SEO / Content",
  exports: "Exports / Published",
};

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  color: z.string().default("#7C8CF8"),
  icon: z.string().default("sparkles"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceInput = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string().default(""),
  icon: z.string().default("bot"),
  color: z.string().default("#A78BFA"),
  system: z.boolean().default(false),
  modelRoute: TaskTypeSchema.default("chat"),
  tools: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  workspaceAccess: z.array(z.string()).default([]), // empty = all workspaces
  memoryScope: z.enum(["workspace", "global", "none"]).default("workspace"),
  status: z.enum(["idle", "running", "error", "disabled"]).default("idle"),
  instructions: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentPatchInput = z.object({
  description: z.string().max(2000).optional(),
  instructions: z.string().max(8000).optional(),
  modelRoute: TaskTypeSchema.optional(),
  status: z.enum(["idle", "disabled"]).optional(),
  memoryScope: z.enum(["workspace", "global", "none"]).optional(),
});

/* ------------------------------------------------------------------ */
/* Agent runs                                                          */
/* ------------------------------------------------------------------ */

export const RunLogSchema = z.object({
  at: z.string(),
  level: z.enum(["info", "tool", "warn", "error"]),
  message: z.string(),
});
export type RunLog = z.infer<typeof RunLogSchema>;

export const AgentRunSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  agentId: z.string(),
  sessionId: z.string().nullable().optional(),
  providerId: z.string().default("local-dev"),
  model: z.string().default("local-dev"),
  title: z.string(),
  input: z.string(),
  output: z.string().default(""),
  status: z.enum(["queued", "running", "complete", "failed", "cancelled"]),
  degraded: z.boolean().default(false),
  logs: z.array(RunLogSchema).default([]),
  toolCalls: z.array(z.string()).default([]),
  artifacts: z.array(z.string()).default([]),
  memoryWriteIds: z.array(z.string()).default([]),
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const RunInput = z.object({
  input: z.string().min(1, "Prompt is required").max(20000),
  workspaceId: z.string().optional(),
  taskType: TaskTypeSchema.optional(),
  providerId: z.string().optional(),
  title: z.string().max(120).optional(),
  skillIds: z.array(z.string()).max(8).optional(),
  taskId: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Chat sessions                                                       */
/* ------------------------------------------------------------------ */

export const ChatSessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  agentId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const ChatCreateInput = z.object({
  agentId: z.string(),
  input: z.string().min(1, "Message is required").max(20000),
  workspaceId: z.string().optional(),
  skillIds: z.array(z.string()).max(8).optional(),
});

export const ChatMessageInput = z.object({
  input: z.string().min(1, "Message is required").max(20000),
  skillIds: z.array(z.string()).max(8).optional(),
});

/* ------------------------------------------------------------------ */
/* Skills (Cursor-compatible SKILL.md)                                 */
/* ------------------------------------------------------------------ */

/** Matches Cursor/Claude skill `name`: lowercase, numbers, hyphens, max 64. */
export const SkillNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Name must be lowercase letters, numbers, and hyphens only");

export const SkillSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: SkillNameSchema,
  description: z.string().min(1).max(1024),
  body: z.string(),
  filePath: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

export type SkillWithWorkspace = Skill & { workspaceName: string; workspaceSlug: string };

/* ------------------------------------------------------------------ */
/* Connectors                                                          */
/* ------------------------------------------------------------------ */

export const ConnectorAuthTypeSchema = z.enum(["oauth2", "api_key", "mcp", "local"]);
export type ConnectorAuthType = z.infer<typeof ConnectorAuthTypeSchema>;

export const ConnectorCategorySchema = z.enum(["communication", "productivity", "creative", "mcp"]);
export type ConnectorCategory = z.infer<typeof ConnectorCategorySchema>;

export const ConnectorStatusSchema = z.enum(["disconnected", "connected", "error", "coming_soon"]);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;

export const WorkspaceConnectorSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  connectorId: z.string(),
  enabled: z.boolean().default(true),
  status: ConnectorStatusSchema.default("disconnected"),
  config: z.record(z.string()).default({}),
  credentialRef: z.string().optional(),
  connectedAt: z.string().nullable().optional(),
  updatedAt: z.string(),
});
export type WorkspaceConnector = z.infer<typeof WorkspaceConnectorSchema>;

export const ConnectorCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: ConnectorCategorySchema,
  authType: ConnectorAuthTypeSchema,
  icon: z.string(),
  envKey: z.string().default(""),
  oauthProvider: z.string().optional(),
  docsUrl: z.string().optional(),
  configurable: z.boolean().default(false),
});
export type ConnectorCatalogItem = z.infer<typeof ConnectorCatalogItemSchema>;

export const ConnectorViewSchema = ConnectorCatalogItemSchema.extend({
  binding: WorkspaceConnectorSchema.nullable(),
  configured: z.boolean().default(false),
});
export type ConnectorView = z.infer<typeof ConnectorViewSchema>;

export const ConnectorPatchInput = z.object({
  workspaceId: z.string(),
  enabled: z.boolean(),
});

export const ConnectorConnectInput = z.object({
  workspaceId: z.string(),
  config: z.record(z.string()).optional(),
});

export const OAuthTokenSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: z.literal("google"),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
  scopes: z.array(z.string()).default([]),
  email: z.string().default(""),
  updatedAt: z.string(),
});
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;

export const MailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  snippet: z.string(),
  date: z.string(),
  unread: z.boolean().default(false),
});
export type MailMessage = z.infer<typeof MailMessageSchema>;

export const MailDetailSchema = MailMessageSchema.extend({
  to: z.string().default(""),
  body: z.string().default(""),
});
export type MailDetail = z.infer<typeof MailDetailSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean().default(false),
  location: z.string().default(""),
  description: z.string().default(""),
  htmlLink: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarEventCreateInput = z.object({
  workspaceId: z.string(),
  title: z.string().min(1).max(200),
  start: z.string(),
  end: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Model providers                                                     */
/* ------------------------------------------------------------------ */

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["openrouter", "anthropic", "openai", "gemini", "xai", "local"]),
  envKey: z.string().default(""),
  defaultModel: z.string(),
  defaultFor: z.array(TaskTypeSchema).default([]),
  note: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Provider = z.infer<typeof ProviderSchema>;

/* ------------------------------------------------------------------ */
/* Kanban tasks                                                        */
/* ------------------------------------------------------------------ */

export const ChecklistItemSchema = z.object({
  text: z.string(),
  done: z.boolean().default(false),
});

export const TaskCommentSchema = z.object({
  at: z.string(),
  author: z.string(),
  text: z.string(),
});

export const TaskCardSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  column: KanbanColumnSchema.default("triage"),
  order: z.number().default(0),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedAgentId: z.string().nullable().default(null),
  linkedGoalId: z.string().nullable().default(null),
  linkedMilestoneIndex: z.number().nullable().default(null),
  linkedNoteIds: z.array(z.string()).default([]),
  checklist: z.array(ChecklistItemSchema).default([]),
  comments: z.array(TaskCommentSchema).default([]),
  dueDate: z.string().nullable().default(null),
  seeded: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskCard = z.infer<typeof TaskCardSchema>;

export const TaskInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(4000).optional(),
  column: KanbanColumnSchema.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedAgentId: z.string().nullable().optional(),
  linkedGoalId: z.string().nullable().optional(),
  linkedMilestoneIndex: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  workspaceId: z.string().optional(),
});

export const TaskPatchInput = TaskInput.partial().extend({
  column: KanbanColumnSchema.optional(),
  order: z.number().optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
  comment: z.string().max(2000).optional(),
  linkedMilestoneIndex: z.number().nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

export const MilestoneSchema = z.object({
  text: z.string(),
  done: z.boolean().default(false),
});

export const GoalSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  objective: z.string().default(""),
  constraints: z.string().default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedAgentIds: z.array(z.string()).default([]),
  status: z.enum(["idle", "active", "blocked", "complete", "failed"]).default("idle"),
  milestones: z.array(MilestoneSchema).default([]),
  progress: z.number().min(0).max(100).default(0),
  seeded: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  objective: z.string().max(4000).optional(),
  constraints: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignedAgentIds: z.array(z.string()).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  workspaceId: z.string().optional(),
});

export const GoalPatchInput = GoalInput.partial().extend({
  status: z.enum(["idle", "active", "blocked", "complete", "failed"]).optional(),
  progress: z.number().min(0).max(100).optional(),
});

/* ------------------------------------------------------------------ */
/* Studio assets                                                       */
/* ------------------------------------------------------------------ */

export const StudioAssetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: z.enum(["image", "video", "audio", "document", "prompt", "html", "other"]),
  bucket: BucketSchema.default("images"),
  title: z.string(),
  prompt: z.string().default(""),
  filePath: z.string().nullable().default(null), // relative to uploads dir
  mimeType: z.string().nullable().default(null),
  size: z.number().nullable().default(null),
  provider: z.string().default("local"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StudioAsset = z.infer<typeof StudioAssetSchema>;

export const StudioPromptInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  prompt: z.string().min(1, "Prompt is required").max(8000),
  type: z.enum(["image", "video", "audio", "prompt"]).default("prompt"),
  workspaceId: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Notebooks                                                           */
/* ------------------------------------------------------------------ */

export const NotebookSourceSchema = z.object({
  id: z.string(),
  kind: z.enum(["text", "markdown", "url", "note"]),
  title: z.string(),
  content: z.string(),
  addedAt: z.string(),
});

export const NotebookOutputSchema = z.object({
  id: z.string(),
  kind: z.enum(["summary", "podcast-outline", "infographic-outline", "repurpose-plan"]),
  content: z.string(),
  provider: z.string(),
  createdAt: z.string(),
});

export const NotebookSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  sources: z.array(NotebookSourceSchema).default([]),
  outputs: z.array(NotebookOutputSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Notebook = z.infer<typeof NotebookSchema>;

export const NotebookInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().optional(),
});

export const NotebookSourceInput = z.object({
  kind: z.enum(["text", "markdown", "url", "note"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
});

/* ------------------------------------------------------------------ */
/* SEO                                                                 */
/* ------------------------------------------------------------------ */

export const SeoKeywordSchema = z.object({
  keyword: z.string(),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]).default("informational"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  targetPage: z.string().default(""),
  notes: z.string().default(""),
});

export const SeoPageSchema = z.object({
  url: z.string(),
  title: z.string().default(""),
  status: z.enum(["planned", "drafted", "published", "needs-update"]).default("planned"),
  targetKeywords: z.array(z.string()).default([]),
});

export const SeoProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  domain: z.string(),
  description: z.string().default(""),
  keywords: z.array(SeoKeywordSchema).default([]),
  pages: z.array(SeoPageSchema).default([]),
  schemaDrafts: z
    .array(z.object({ id: z.string(), title: z.string(), json: z.string(), createdAt: z.string() }))
    .default([]),
  internalLinks: z
    .array(z.object({ from: z.string(), to: z.string(), anchor: z.string(), reason: z.string() }))
    .default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SeoProject = z.infer<typeof SeoProjectSchema>;

export const SeoProjectInput = z.object({
  domain: z.string().min(1, "Domain or project name is required").max(200),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Memory (vault notes)                                                */
/* ------------------------------------------------------------------ */

export const NoteMetaSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  type: NoteTypeSchema.default("Research"),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  para: z.enum(["projects", "areas", "resources", "archive"]).default("resources"),
  sourceType: z.string().nullable().default(null),
  sourceId: z.string().nullable().default(null),
  path: z.string(), // relative to vault dir
  excerpt: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NoteMeta = z.infer<typeof NoteMetaSchema>;

export type Note = NoteMeta & { markdown: string; backlinks: string[]; outlinks: string[] };

export const NoteInput = z.object({
  title: z.string().min(1, "Title is required").max(200),
  markdown: z.string().max(200000).default(""),
  type: NoteTypeSchema.optional(),
  tags: z.array(z.string().max(40)).optional(),
  para: z.enum(["projects", "areas", "resources", "archive"]).optional(),
  pinned: z.boolean().optional(),
  workspaceId: z.string().optional(),
});

export const NotePatchInput = NoteInput.partial();

/* ------------------------------------------------------------------ */
/* Memory write queue (the Loop)                                       */
/* ------------------------------------------------------------------ */

export const MemoryWriteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  type: NoteTypeSchema,
  markdown: z.string(),
  tags: z.array(z.string()).default([]),
  sourceType: z.string(),
  sourceId: z.string(),
  status: z.enum(["pending", "approved", "auto", "written", "rejected", "failed"]),
  error: z.string().nullable().default(null),
  noteId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MemoryWrite = z.infer<typeof MemoryWriteSchema>;

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export const AuditEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable(),
  actorType: z.enum(["user", "agent", "system"]),
  actorId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  details: z.string().default(""),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const SettingsSchema = z.object({
  activeWorkspaceId: z.string(),
  vaultPath: z.string().default(""),
  routingRules: z.record(TaskTypeSchema, z.string()).default({
    chat: "openrouter",
    reasoning: "anthropic",
    coding: "openai",
    "long-context": "gemini",
    multimodal: "xai",
    research: "openrouter",
  }),
  autoWriteRunLogs: z.boolean().default(true),
  terminalEnabled: z.boolean().default(true),
  theme: z.string().default("midnight-aubergine"),
  featureFlags: z.record(z.string(), z.boolean()).default({}),
  lastLoopRunAt: z.string().nullable().default(null),
  lastTestRunAt: z.string().nullable().default(null),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsPatchInput = z.object({
  activeWorkspaceId: z.string().optional(),
  routingRules: z.record(TaskTypeSchema, z.string()).optional(),
  autoWriteRunLogs: z.boolean().optional(),
  terminalEnabled: z.boolean().optional(),
});
