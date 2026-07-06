import { readCollection, updateCollection, readDoc, writeDoc } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { WorkspaceInput, type Settings, type Workspace } from "@/lib/schemas";
import { nowIso, slugify } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const input = await parseBody(req, WorkspaceInput.partial());
    const items = await readCollection<Workspace>("workspaces");
    const existing = items.find((w) => w.id === id);
    if (!existing) throw new Error("Workspace not found");
    const updated: Workspace = {
      ...existing,
      ...input,
      slug: input.name ? slugify(input.name) : existing.slug,
      description: input.description ?? existing.description,
      updatedAt: nowIso(),
    };
    await updateCollection<Workspace>("workspaces", (ws) => ws.map((w) => (w.id === id ? updated : w)));
    await audit({
      workspaceId: id,
      actorType: "user",
      actorId: "you",
      action: "workspace.update",
      targetType: "workspace",
      targetId: id,
      details: updated.name,
    });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const items = await readCollection<Workspace>("workspaces");
    if (items.length <= 1) throw new Error("Cannot delete the last workspace");
    const target = items.find((w) => w.id === id);
    if (!target) throw new Error("Workspace not found");
    await updateCollection<Workspace>("workspaces", (ws) => ws.filter((w) => w.id !== id));
    // Repoint active workspace if needed
    const settings = await readDoc<Partial<Settings>>("settings", {});
    if (settings.activeWorkspaceId === id) {
      const remaining = items.filter((w) => w.id !== id);
      await writeDoc("settings", { ...settings, activeWorkspaceId: remaining[0].id });
    }
    await audit({
      workspaceId: null,
      actorType: "user",
      actorId: "you",
      action: "workspace.delete",
      targetType: "workspace",
      targetId: id,
      details: `${target.name} (vault files are preserved on disk)`,
    });
    return { deleted: id };
  });
}
