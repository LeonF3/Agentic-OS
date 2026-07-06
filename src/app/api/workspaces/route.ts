import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { WorkspaceInput, type Workspace } from "@/lib/schemas";
import { newId, nowIso, slugify } from "@/lib/ids";
import { audit } from "@/lib/audit";

export async function GET() {
  return withDb(() => readCollection<Workspace>("workspaces"));
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, WorkspaceInput);
    const now = nowIso();
    const ws: Workspace = {
      id: newId("workspace"),
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? "",
      color: input.color ?? "#7C8CF8",
      icon: input.icon ?? "sparkles",
      createdAt: now,
      updatedAt: now,
    };
    const existing = await readCollection<Workspace>("workspaces");
    if (existing.some((w) => w.slug === ws.slug)) throw new Error(`A workspace named "${input.name}" already exists`);
    await updateCollection<Workspace>("workspaces", (items) => [...items, ws]);
    await audit({
      workspaceId: ws.id,
      actorType: "user",
      actorId: "you",
      action: "workspace.create",
      targetType: "workspace",
      targetId: ws.id,
      details: ws.name,
    });
    return ws;
  });
}
