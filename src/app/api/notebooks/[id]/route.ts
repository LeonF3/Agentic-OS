import { readCollection, updateCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import { NotebookSourceInput, type Notebook } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const notebooks = await readCollection<Notebook>("notebooks");
    const nb = notebooks.find((n) => n.id === id);
    if (!nb) throw new Error("Notebook not found");
    return nb;
  });
}

/** Add a source, or remove one with { removeSourceId }. */
export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const notebooks = await readCollection<Notebook>("notebooks");
    const nb = notebooks.find((n) => n.id === id);
    if (!nb) throw new Error("Notebook not found");

    let updated: Notebook;
    if (typeof body.removeSourceId === "string") {
      updated = { ...nb, sources: nb.sources.filter((s) => s.id !== body.removeSourceId), updatedAt: nowIso() };
    } else if (typeof body.title === "string" && body.kind === undefined) {
      const patch = z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).optional() }).parse(body);
      updated = { ...nb, title: patch.title, description: patch.description ?? nb.description, updatedAt: nowIso() };
    } else {
      const source = NotebookSourceInput.parse(body);
      updated = {
        ...nb,
        sources: [...nb.sources, { ...source, id: newId("notebook"), addedAt: nowIso() }],
        updatedAt: nowIso(),
      };
    }
    await updateCollection<Notebook>("notebooks", (items) => items.map((n) => (n.id === id ? updated : n)));
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const notebooks = await readCollection<Notebook>("notebooks");
    const nb = notebooks.find((n) => n.id === id);
    if (!nb) throw new Error("Notebook not found");
    await updateCollection<Notebook>("notebooks", (items) => items.filter((n) => n.id !== id));
    await audit({
      workspaceId: nb.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "notebook.delete",
      targetType: "notebook",
      targetId: id,
      details: nb.title,
    });
    return { deleted: id };
  });
}
