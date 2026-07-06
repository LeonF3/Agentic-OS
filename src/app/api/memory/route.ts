import { readCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { NoteInput, type Workspace } from "@/lib/schemas";
import { listNotes, createNote, tagCloud } from "@/lib/vault";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const query = url.searchParams.get("q") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;
    const notes = await listNotes({ workspaceId, query, type, tag });
    const tags = await tagCloud(workspaceId);
    return { notes, tags };
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, NoteInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const workspaces = await readCollection<Workspace>("workspaces");
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) throw new Error("Workspace not found");
    const meta = await createNote({
      workspaceId: ws.id,
      workspaceSlug: ws.slug,
      title: input.title,
      markdown: input.markdown,
      type: input.type,
      tags: input.tags,
      para: input.para,
      pinned: input.pinned,
      sourceType: "manual",
    });
    await audit({
      workspaceId: ws.id,
      actorType: "user",
      actorId: "you",
      action: "note.create",
      targetType: "note",
      targetId: meta.id,
      details: meta.title,
    });
    return meta;
  });
}
