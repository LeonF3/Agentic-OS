import path from "node:path";
import fsp from "node:fs/promises";
import { readCollection, updateCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { StudioAsset, Workspace } from "@/lib/schemas";
import { uploadsDir, ensureDir } from "@/lib/paths";
import { newId, nowIso, slugify } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/modelrouter";

const MAX_UPLOAD = 100 * 1024 * 1024; // 100MB

function typeFromMime(mime: string): StudioAsset["type"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "text/html") return "html";
  if (mime === "application/pdf" || mime.startsWith("text/")) return "document";
  return "other";
}

function bucketFor(type: StudioAsset["type"]): StudioAsset["bucket"] {
  switch (type) {
    case "image":
      return "images";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "html":
      return "code";
    default:
      return "documents";
  }
}

export async function POST(req: Request) {
  return withDb(async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No file provided — attach a file field named 'file'");
    if (file.size > MAX_UPLOAD) throw new Error("File exceeds the 100MB upload limit");

    const settings = await getSettings();
    const workspaceId = (form.get("workspaceId") as string) || settings.activeWorkspaceId;
    const workspaces = await readCollection<Workspace>("workspaces");
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) throw new Error("Workspace not found");

    const ext = path.extname(file.name) || "";
    const base = slugify(path.basename(file.name, ext)) || "upload";
    const rel = path.join(ws.slug, `${base}-${Date.now().toString(36)}${ext}`);
    const dir = path.join(uploadsDir(), ws.slug);
    ensureDir(dir);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fsp.writeFile(path.join(uploadsDir(), rel), buffer);

    const mime = file.type || "application/octet-stream";
    const type = typeFromMime(mime);
    const now = nowIso();
    const asset: StudioAsset = {
      id: newId("asset"),
      workspaceId,
      type,
      bucket: bucketFor(type),
      title: (form.get("title") as string) || file.name,
      prompt: "",
      filePath: rel,
      mimeType: mime,
      size: file.size,
      provider: "upload",
      metadata: { originalName: file.name },
      createdAt: now,
      updatedAt: now,
    };
    await updateCollection<StudioAsset>("assets", (items) => [asset, ...items]);
    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "asset.upload",
      targetType: "asset",
      targetId: asset.id,
      details: `${asset.title} (${mime}, ${file.size} bytes)`,
    });
    return asset;
  });
}
