import fs from "node:fs";
import fsp from "node:fs/promises";
import { readCollection, updateCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { StudioAsset } from "@/lib/schemas";
import { uploadsDir, safeJoin } from "@/lib/paths";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const assets = await readCollection<StudioAsset>("assets");
    const asset = assets.find((a) => a.id === id);
    if (!asset) throw new Error("Asset not found");
    return asset;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const assets = await readCollection<StudioAsset>("assets");
    const asset = assets.find((a) => a.id === id);
    if (!asset) throw new Error("Asset not found");
    if (asset.filePath) {
      const abs = safeJoin(uploadsDir(), asset.filePath);
      if (abs && fs.existsSync(abs)) await fsp.unlink(abs);
    }
    await updateCollection<StudioAsset>("assets", (items) => items.filter((a) => a.id !== id));
    await audit({
      workspaceId: asset.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "asset.delete",
      targetType: "asset",
      targetId: id,
      details: asset.title,
    });
    return { deleted: id };
  });
}
