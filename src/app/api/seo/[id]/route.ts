import { readCollection, updateCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import { SeoKeywordSchema, SeoPageSchema, type SeoProject } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const projects = await readCollection<SeoProject>("seo");
    const project = projects.find((p) => p.id === id);
    if (!project) throw new Error("SEO project not found");
    return project;
  });
}

const PatchInput = z.object({
  addKeyword: SeoKeywordSchema.optional(),
  removeKeyword: z.string().optional(),
  addPage: SeoPageSchema.optional(),
  removePage: z.string().optional(),
  description: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const body = PatchInput.parse(await req.json().catch(() => ({})));
    const projects = await readCollection<SeoProject>("seo");
    const project = projects.find((p) => p.id === id);
    if (!project) throw new Error("SEO project not found");
    const updated: SeoProject = { ...project, updatedAt: nowIso() };
    if (body.addKeyword) {
      if (updated.keywords.some((k) => k.keyword.toLowerCase() === body.addKeyword!.keyword.toLowerCase()))
        throw new Error("Keyword already tracked");
      updated.keywords = [...updated.keywords, body.addKeyword];
    }
    if (body.removeKeyword) updated.keywords = updated.keywords.filter((k) => k.keyword !== body.removeKeyword);
    if (body.addPage) {
      if (updated.pages.some((p) => p.url === body.addPage!.url)) throw new Error("Page already in inventory");
      updated.pages = [...updated.pages, body.addPage];
    }
    if (body.removePage) updated.pages = updated.pages.filter((p) => p.url !== body.removePage);
    if (body.description !== undefined) updated.description = body.description;
    await updateCollection<SeoProject>("seo", (items) => items.map((p) => (p.id === id ? updated : p)));
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const projects = await readCollection<SeoProject>("seo");
    const project = projects.find((p) => p.id === id);
    if (!project) throw new Error("SEO project not found");
    await updateCollection<SeoProject>("seo", (items) => items.filter((p) => p.id !== id));
    await audit({
      workspaceId: project.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "seo.delete-project",
      targetType: "seo",
      targetId: id,
      details: project.domain,
    });
    return { deleted: id };
  });
}
