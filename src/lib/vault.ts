import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { vaultDir, ensureDir, safeJoin } from "./paths";
import { readCollection, updateCollection } from "./store";
import { newId, nowIso, slugify } from "./ids";
import type { Note, NoteMeta, NoteType } from "./schemas";

/**
 * The Vault — Obsidian-compatible markdown memory.
 *
 * Notes are plain .md files with YAML frontmatter, organized PARA-style:
 *   vault/<workspace-slug>/{projects,areas,resources,archive}/<slug>.md
 *
 * A metadata index lives in .swos-data/vault-index.json so list/search is
 * fast; the markdown files remain the source of truth and the index can be
 * rebuilt from disk at any time (rebuildIndex).
 */

const INDEX = "vault-index";

const TYPE_TO_PARA: Partial<Record<NoteType, NoteMeta["para"]>> = {
  Project: "projects",
  Goal: "projects",
  Task: "projects",
  Client: "areas",
  Person: "areas",
  Workspace: "areas",
  "Agent Run": "resources",
  Research: "resources",
  "Content Output": "resources",
  "Code Change": "resources",
  Asset: "resources",
  Meeting: "resources",
  Decision: "resources",
  Reflection: "resources",
  "System Log": "archive",
};

function excerptOf(markdown: string): string {
  return markdown
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function extractOutlinks(markdown: string): string[] {
  const links = new Set<string>();
  for (const m of markdown.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    links.add(m[1].trim());
  }
  return [...links];
}

async function readIndex(): Promise<NoteMeta[]> {
  return readCollection<NoteMeta>(INDEX);
}

function notePath(workspaceSlug: string, para: NoteMeta["para"], slug: string): string {
  return path.join(workspaceSlug, para, `${slug}.md`);
}

function serializeNote(meta: NoteMeta, markdown: string): string {
  return matter.stringify(markdown, {
    id: meta.id,
    title: meta.title,
    type: meta.type,
    workspace: meta.workspaceId,
    tags: meta.tags,
    pinned: meta.pinned,
    sourceType: meta.sourceType,
    sourceId: meta.sourceId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  });
}

export async function listNotes(opts: {
  workspaceId?: string;
  query?: string;
  type?: string;
  tag?: string;
  pinned?: boolean;
}): Promise<NoteMeta[]> {
  let notes = await readIndex();
  if (opts.workspaceId) notes = notes.filter((n) => n.workspaceId === opts.workspaceId);
  if (opts.type) notes = notes.filter((n) => n.type === opts.type);
  if (opts.tag) notes = notes.filter((n) => n.tags.includes(opts.tag!));
  if (opts.pinned !== undefined) notes = notes.filter((n) => n.pinned === opts.pinned);
  if (opts.query) {
    const q = opts.query.toLowerCase();
    const scored: { n: NoteMeta; score: number }[] = [];
    for (const n of notes) {
      let score = 0;
      if (n.title.toLowerCase().includes(q)) score += 10;
      if (n.tags.some((t) => t.toLowerCase().includes(q))) score += 5;
      if (n.excerpt.toLowerCase().includes(q)) score += 2;
      if (score === 0) {
        // full-text fallback against the file itself
        try {
          const p = safeJoin(vaultDir(), n.path);
          if (p && fs.existsSync(p)) {
            const raw = await fsp.readFile(p, "utf8");
            if (raw.toLowerCase().includes(q)) score += 1;
          }
        } catch {
          /* unreadable note file — skip full-text for it */
        }
      }
      if (score > 0) scored.push({ n, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.n);
  }
  return notes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getNote(id: string): Promise<Note | null> {
  const index = await readIndex();
  const meta = index.find((n) => n.id === id);
  if (!meta) return null;
  const p = safeJoin(vaultDir(), meta.path);
  if (!p || !fs.existsSync(p)) return { ...meta, markdown: "", backlinks: [], outlinks: [] };
  const raw = await fsp.readFile(p, "utf8");
  const parsed = matter(raw);
  const markdown = parsed.content.trimStart();
  const outlinks = extractOutlinks(markdown);
  // backlinks: notes whose outlinks include this note's title
  const backlinks: string[] = [];
  for (const other of index) {
    if (other.id === meta.id) continue;
    const op = safeJoin(vaultDir(), other.path);
    if (!op || !fs.existsSync(op)) continue;
    try {
      const oraw = await fsp.readFile(op, "utf8");
      if (extractOutlinks(matter(oraw).content).some((t) => t.toLowerCase() === meta.title.toLowerCase())) {
        backlinks.push(other.id);
      }
    } catch {
      /* skip unreadable */
    }
  }
  return { ...meta, markdown, backlinks, outlinks };
}

export async function createNote(input: {
  workspaceId: string;
  workspaceSlug: string;
  title: string;
  markdown?: string;
  type?: NoteType;
  tags?: string[];
  para?: NoteMeta["para"];
  pinned?: boolean;
  sourceType?: string | null;
  sourceId?: string | null;
}): Promise<NoteMeta> {
  const now = nowIso();
  const type = input.type ?? "Research";
  const para = input.para ?? TYPE_TO_PARA[type] ?? "resources";
  let slug = slugify(input.title);
  const dir = path.join(vaultDir(), input.workspaceSlug, para);
  ensureDir(dir);
  if (fs.existsSync(path.join(dir, `${slug}.md`))) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const meta: NoteMeta = {
    id: newId("note"),
    workspaceId: input.workspaceId,
    title: input.title,
    type,
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    para,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    path: notePath(input.workspaceSlug, para, slug),
    excerpt: excerptOf(input.markdown ?? ""),
    createdAt: now,
    updatedAt: now,
  };
  await fsp.writeFile(path.join(vaultDir(), meta.path), serializeNote(meta, input.markdown ?? ""), "utf8");
  await updateCollection<NoteMeta>(INDEX, (items) => [meta, ...items.filter((n) => n.id !== meta.id)]);
  return meta;
}

export async function updateNote(
  id: string,
  patch: {
    title?: string;
    markdown?: string;
    type?: NoteType;
    tags?: string[];
    pinned?: boolean;
    para?: NoteMeta["para"];
  }
): Promise<NoteMeta | null> {
  const index = await readIndex();
  const meta = index.find((n) => n.id === id);
  if (!meta) return null;
  const p = safeJoin(vaultDir(), meta.path);
  let markdown = patch.markdown;
  if (markdown === undefined && p && fs.existsSync(p)) {
    markdown = matter(await fsp.readFile(p, "utf8")).content.trimStart();
  }
  const updated: NoteMeta = {
    ...meta,
    title: patch.title ?? meta.title,
    type: patch.type ?? meta.type,
    tags: patch.tags ?? meta.tags,
    pinned: patch.pinned ?? meta.pinned,
    para: patch.para ?? meta.para,
    excerpt: excerptOf(markdown ?? ""),
    updatedAt: nowIso(),
  };
  // If the PARA folder changed, move the file.
  if (updated.para !== meta.para) {
    const segments = meta.path.split(path.sep);
    segments[segments.length - 2] = updated.para;
    const newRel = segments.join(path.sep);
    const newAbs = safeJoin(vaultDir(), newRel);
    if (p && newAbs && fs.existsSync(p)) {
      ensureDir(path.dirname(newAbs));
      await fsp.rename(p, newAbs);
    }
    updated.path = newRel;
  }
  const target = safeJoin(vaultDir(), updated.path);
  if (target) {
    ensureDir(path.dirname(target));
    await fsp.writeFile(target, serializeNote(updated, markdown ?? ""), "utf8");
  }
  await updateCollection<NoteMeta>(INDEX, (items) => items.map((n) => (n.id === id ? updated : n)));
  return updated;
}

export async function deleteNote(id: string): Promise<boolean> {
  const index = await readIndex();
  const meta = index.find((n) => n.id === id);
  if (!meta) return false;
  const p = safeJoin(vaultDir(), meta.path);
  if (p && fs.existsSync(p)) await fsp.unlink(p);
  await updateCollection<NoteMeta>(INDEX, (items) => items.filter((n) => n.id !== id));
  return true;
}

/** Rebuild the metadata index by scanning every .md file in the vault. */
export async function rebuildIndex(): Promise<number> {
  const root = vaultDir();
  ensureDir(root);
  const metas: NoteMeta[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const raw = await fsp.readFile(full, "utf8");
          const parsed = matter(raw);
          const fm = parsed.data as Record<string, unknown>;
          const rel = path.relative(root, full);
          const para = (rel.split(path.sep)[1] ?? "resources") as NoteMeta["para"];
          metas.push({
            id: typeof fm.id === "string" ? fm.id : newId("note"),
            workspaceId: typeof fm.workspace === "string" ? fm.workspace : "unknown",
            title: typeof fm.title === "string" ? fm.title : entry.name.replace(/\.md$/, ""),
            type: (typeof fm.type === "string" ? fm.type : "Research") as NoteMeta["type"],
            tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
            pinned: fm.pinned === true,
            para: ["projects", "areas", "resources", "archive"].includes(para) ? para : "resources",
            sourceType: typeof fm.sourceType === "string" ? fm.sourceType : null,
            sourceId: typeof fm.sourceId === "string" ? fm.sourceId : null,
            path: rel,
            excerpt: excerptOf(parsed.content),
            createdAt: typeof fm.createdAt === "string" ? fm.createdAt : nowIso(),
            updatedAt: typeof fm.updatedAt === "string" ? fm.updatedAt : nowIso(),
          });
        } catch {
          /* skip unparsable files */
        }
      }
    }
  };
  await walk(root);
  metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  await updateCollection<NoteMeta>(INDEX, () => metas);
  return metas.length;
}

/** Top tags across a workspace (or all), with counts. */
export async function tagCloud(workspaceId?: string): Promise<{ tag: string; count: number }[]> {
  const notes = await listNotes({ workspaceId });
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}
