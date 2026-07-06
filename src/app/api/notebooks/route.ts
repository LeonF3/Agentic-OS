import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { NotebookInput, type Notebook } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    let notebooks = await readCollection<Notebook>("notebooks");
    if (workspaceId) notebooks = notebooks.filter((n) => n.workspaceId === workspaceId);
    return notebooks;
  });
}

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, NotebookInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const now = nowIso();
    const notebook: Notebook = {
      id: newId("notebook"),
      workspaceId,
      title: input.title,
      description: input.description ?? "",
      sources: [],
      outputs: [],
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<Notebook>("notebooks", (items) => [notebook, ...items]);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "notebook.create",
      targetType: "notebook",
      targetId: notebook.id,
      details: notebook.title,
    });
    return notebook;
  });
}
