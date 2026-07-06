import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { SeoProjectInput, type SeoProject } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    let projects = await readCollection<SeoProject>("seo");
    if (workspaceId) projects = projects.filter((p) => p.workspaceId === workspaceId);
    return projects;
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, SeoProjectInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const now = nowIso();
    const project: SeoProject = {
      id: newId("seo"),
      workspaceId,
      domain: input.domain,
      description: input.description ?? "",
      keywords: [],
      pages: [],
      schemaDrafts: [],
      internalLinks: [],
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<SeoProject>("seo", (items) => [project, ...items]);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "seo.create-project",
      targetType: "seo",
      targetId: project.id,
      details: project.domain,
    });
    return project;
  });
}
