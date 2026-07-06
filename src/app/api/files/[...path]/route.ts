import fs from "node:fs";
import fsp from "node:fs/promises";
import { NextResponse } from "next/server";
import { uploadsDir, safeJoin } from "@/lib/paths";

/**
 * Serves uploaded media from .swos-data/uploads only. Path traversal is
 * refused by safeJoin. HTML is served as text/plain unless ?raw=1&sandbox=1
 * is used by the sandboxed preview iframe (which applies a CSP).
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
};

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const abs = safeJoin(uploadsDir(), ...segments);
  if (!abs) return NextResponse.json({ ok: false, error: "Path outside uploads directory" }, { status: 403 });
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return NextResponse.json({ ok: false, error: "File not found" }, { status: 404 });
  }
  const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
  let contentType = MIME[ext] ?? "application/octet-stream";
  const url = new URL(req.url);
  const headers: Record<string, string> = { "Cache-Control": "private, max-age=60" };

  if (ext === ".html") {
    if (url.searchParams.get("sandbox") === "1") {
      // Sandboxed preview: no scripts, no external fetches.
      headers["Content-Security-Policy"] = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'";
    } else {
      contentType = "text/plain; charset=utf-8";
    }
  }

  const data = await fsp.readFile(abs);
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Type": contentType } });
}
