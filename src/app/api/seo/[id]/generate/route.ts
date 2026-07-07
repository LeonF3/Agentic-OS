import { z } from "zod";
import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import type { MemoryWrite, SeoProject, TaskCard } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { runModel } from "@/lib/modelrouter";
import { generateSchemaDraft, suggestInternalLinks, contentBriefPrompt } from "@/lib/generators";

type Params = { params: Promise<{ id: string }> };

const GenInput = z.object({
  kind: z.enum(["schema", "internal-links", "content-brief", "kanban-task"]),
  pageUrl: z.string().optional(),
  keyword: z.string().optional(),
});

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const input = await parseBody(req, GenInput);
    const projects = await readCollection<SeoProject>("seo");
    const project = projects.find((p) => p.id === id);
    if (!project) throw new Error("SEO project not found");

    if (input.kind === "schema") {
      const draft = generateSchemaDraft(project, input.pageUrl);
      const record = { id: newId("seo"), title: draft.title, json: draft.json, createdAt: nowIso() };
      const updated = { ...project, schemaDrafts: [record, ...project.schemaDrafts], updatedAt: nowIso() };
      await updateCollection<SeoProject>("seo", (items) => items.map((p) => (p.id === id ? updated : p)));
      return { kind: input.kind, result: record };
    }

    if (input.kind === "internal-links") {
      if (project.pages.length < 2) throw new Error("Add at least two pages to suggest internal links");
      const links = suggestInternalLinks(project);
      const updated = { ...project, internalLinks: links, updatedAt: nowIso() };
      await updateCollection<SeoProject>("seo", (items) => items.map((p) => (p.id === id ? updated : p)));
      return { kind: input.kind, result: links };
    }

    if (input.kind === "content-brief") {
      if (!input.keyword) throw new Error("Pick a keyword for the brief");
      const { system, prompt } = contentBriefPrompt(project, input.keyword);
      const result = await runModel({ taskType: "research", system, prompt });
      const mw: MemoryWrite = {
        id: newId("queue"),
        workspaceId: project.workspaceId,
        title: `SEO brief: ${input.keyword} (${project.domain})`,
        type: "Content Output",
        markdown: result.output,
        tags: ["seo", "content-brief"],
        sourceType: "seo_brief",
        sourceId: project.id,
        status: "pending",
        error: null,
        noteId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await updateCollection<MemoryWrite>("memory-queue", (items) => [mw, ...items]);
      await audit({
        workspaceId: project.workspaceId,
        actorType: "agent",
        actorId: "hermes",
        action: "seo.brief",
        targetType: "seo",
        targetId: id,
        details: `${input.keyword} via ${result.providerName}`,
      });
      return { kind: input.kind, result: { brief: result.output, provider: result.providerName, degraded: result.degraded } };
    }

    // kanban-task: push an SEO work item into the board
    if (!input.keyword) throw new Error("Pick a keyword to create a task for");
    const task: TaskCard = {
      id: newId("task"),
      workspaceId: project.workspaceId,
      title: `SEO: draft content for "${input.keyword}"`,
      description: `From SEO project ${project.domain}. Target keyword: ${input.keyword}.`,
      column: "outline",
      order: 0,
      priority: "medium",
      assignedAgentId: null,
      linkedGoalId: null,
      linkedMilestoneIndex: null,
      linkedNoteIds: [],
      checklist: [
        { text: "Generate content brief", done: false },
        { text: "Draft content", done: false },
        { text: "Add internal links", done: false },
      ],
      comments: [],
      dueDate: null,
      seeded: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await updateCollection<TaskCard>("tasks", (items) => [...items, task]);
    await audit({
      workspaceId: project.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "seo.task",
      targetType: "task",
      targetId: task.id,
      details: task.title,
    });
    return { kind: input.kind, result: task };
  });
}
