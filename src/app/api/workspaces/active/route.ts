import { z } from "zod";
import { readCollection, readDoc, writeDoc } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import type { Settings, Workspace } from "@/lib/schemas";
import { audit } from "@/lib/audit";

export async function GET() {
  return withDb(async () => {
    const settings = await readDoc<Partial<Settings>>("settings", {});
    const workspaces = await readCollection<Workspace>("workspaces");
    const active = workspaces.find((w) => w.id === settings.activeWorkspaceId) ?? workspaces[0] ?? null;
    return { activeWorkspaceId: active?.id ?? null, workspace: active };
  });
}

export async function PUT(req: Request) {
  return withDb(async () => {
    const { workspaceId } = await parseBody(req, z.object({ workspaceId: z.string() }));
    const workspaces = await readCollection<Workspace>("workspaces");
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!target) throw new Error("Workspace not found");
    const settings = await readDoc<Partial<Settings>>("settings", {});
    await writeDoc("settings", { ...settings, activeWorkspaceId: workspaceId });
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "workspace.switch",
      targetType: "workspace",
      targetId: workspaceId,
      details: target.name,
    });
    return { activeWorkspaceId: workspaceId, workspace: target };
  });
}
