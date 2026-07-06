import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { StudioPromptInput, type MemoryWrite, type StudioAsset } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const type = url.searchParams.get("type");
    let assets = await readCollection<StudioAsset>("assets");
    if (workspaceId) assets = assets.filter((a) => a.workspaceId === workspaceId);
    if (type) assets = assets.filter((a) => a.type === type);
    return assets;
  });
}

/** Save a prompt package (works with zero API keys — honest offline Studio). */
export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, StudioPromptInput);
    const settings = await getSettings();
    const workspaceId = input.workspaceId || settings.activeWorkspaceId;
    const now = nowIso();
    const asset: StudioAsset = {
      id: newId("asset"),
      workspaceId,
      type: input.type,
      bucket:
        input.type === "image" ? "images" : input.type === "video" ? "video" : input.type === "audio" ? "audio" : "documents",
      title: input.title,
      prompt: input.prompt,
      filePath: null,
      mimeType: null,
      size: null,
      provider: "prompt-package",
      metadata: { note: "Prompt package saved locally. Connect a multimodal provider in The Brain to generate." },
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<StudioAsset>("assets", (items) => [asset, ...items]);

    // Queue prompt into memory so the Loop can index it.
    const mw: MemoryWrite = {
      id: newId("queue"),
      workspaceId,
      title: `Studio prompt: ${input.title}`,
      type: "Content Output",
      markdown: `**Type:** ${input.type}\n\n## Prompt\n\n${input.prompt}`,
      tags: ["studio", input.type],
      sourceType: "studio_asset",
      sourceId: asset.id,
      status: "pending",
      error: null,
      noteId: null,
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<MemoryWrite>("memory-queue", (items) => [mw, ...items]);

    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "studio.save-prompt",
      targetType: "asset",
      targetId: asset.id,
      details: input.title,
    });
    return asset;
  });
}
