import { withDb, parseBody } from "@/lib/route-helpers";
import { NotePatchInput } from "@/lib/schemas";
import { getNote, updateNote, deleteNote } from "@/lib/vault";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const note = await getNote(id);
    if (!note) throw new Error("Note not found");
    return note;
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const patch = await parseBody(req, NotePatchInput);
    const updated = await updateNote(id, patch);
    if (!updated) throw new Error("Note not found");
    await audit({
      workspaceId: updated.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "note.update",
      targetType: "note",
      targetId: id,
      details: updated.title,
    });
    return updated;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const note = await getNote(id);
    if (!note) throw new Error("Note not found");
    await deleteNote(id);
    await audit({
      workspaceId: note.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "note.delete",
      targetType: "note",
      targetId: id,
      details: note.title,
    });
    return { deleted: id };
  });
}
