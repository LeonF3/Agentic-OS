import { z } from "zod";
import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import type { MemoryWrite, Notebook } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { runModel } from "@/lib/modelrouter";
import { notebookPrompt } from "@/lib/generators";

type Params = { params: Promise<{ id: string }> };

const GenInput = z.object({
  kind: z.enum(["summary", "podcast-outline", "infographic-outline", "repurpose-plan"]),
});

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const { kind } = await parseBody(req, GenInput);
    const notebooks = await readCollection<Notebook>("notebooks");
    const nb = notebooks.find((n) => n.id === id);
    if (!nb) throw new Error("Notebook not found");
    if (nb.sources.length === 0) throw new Error("Add at least one source before generating");

    const { system, prompt } = notebookPrompt(kind, nb.title, nb.sources);
    const result = await runModel({ taskType: "long-context", system, prompt });

    const output = {
      id: newId("notebook"),
      kind,
      content: result.output,
      provider: result.providerName,
      createdAt: nowIso(),
    };
    const updated: Notebook = { ...nb, outputs: [output, ...nb.outputs], updatedAt: nowIso() };
    await updateCollection<Notebook>("notebooks", (items) => items.map((n) => (n.id === id ? updated : n)));

    // Queue output for the Vault.
    const mw: MemoryWrite = {
      id: newId("queue"),
      workspaceId: nb.workspaceId,
      title: `Notebook ${kind}: ${nb.title}`,
      type: "Content Output",
      markdown: result.output,
      tags: ["notebook", kind],
      sourceType: "notebook_output",
      sourceId: output.id,
      status: "pending",
      error: null,
      noteId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await updateCollection<MemoryWrite>("memory-queue", (items) => [mw, ...items]);

    await audit({
      workspaceId: nb.workspaceId,
      actorType: "agent",
      actorId: "antigravity",
      action: "notebook.generate",
      targetType: "notebook",
      targetId: id,
      details: `${kind} via ${result.providerName}`,
    });
    return { notebook: updated, output };
  });
}
