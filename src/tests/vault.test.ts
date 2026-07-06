import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swos-vault-"));
process.env.SWOS_DATA_DIR = tmp;

import { createNote, getNote, updateNote, deleteNote, listNotes, rebuildIndex, extractOutlinks } from "@/lib/vault";

describe("The Vault", () => {
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("creates a note as a markdown file with frontmatter", async () => {
    const meta = await createNote({
      workspaceId: "ws_test",
      workspaceSlug: "test-ws",
      title: "Hello Vault",
      markdown: "First note referencing [[Other Note]].",
      type: "Research",
      tags: ["test"],
    });
    expect(meta.id).toMatch(/^note_/);
    const abs = path.join(tmp, "vault", meta.path);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = fs.readFileSync(abs, "utf8");
    expect(raw).toContain("title: Hello Vault");
    expect(raw).toContain("[[Other Note]]");
  });

  it("lists and searches notes", async () => {
    await createNote({ workspaceId: "ws_test", workspaceSlug: "test-ws", title: "Quarterly plan", markdown: "Revenue targets", type: "Project" });
    const all = await listNotes({ workspaceId: "ws_test" });
    expect(all.length).toBeGreaterThanOrEqual(2);
    const hits = await listNotes({ workspaceId: "ws_test", query: "revenue" });
    expect(hits.some((n) => n.title === "Quarterly plan")).toBe(true);
  });

  it("computes backlinks from [[wiki links]]", async () => {
    const target = await createNote({ workspaceId: "ws_test", workspaceSlug: "test-ws", title: "Other Note", markdown: "target", type: "Research" });
    const full = await getNote(target.id);
    expect(full?.backlinks.length).toBeGreaterThanOrEqual(1);
  });

  it("updates a note and moves PARA folder", async () => {
    const meta = await createNote({ workspaceId: "ws_test", workspaceSlug: "test-ws", title: "Movable", markdown: "x", type: "Research" });
    const updated = await updateNote(meta.id, { para: "archive", markdown: "updated body" });
    expect(updated?.para).toBe("archive");
    expect(fs.existsSync(path.join(tmp, "vault", updated!.path))).toBe(true);
    const note = await getNote(meta.id);
    expect(note?.markdown).toContain("updated body");
  });

  it("deletes notes and files", async () => {
    const meta = await createNote({ workspaceId: "ws_test", workspaceSlug: "test-ws", title: "Doomed", markdown: "", type: "Research" });
    expect(await deleteNote(meta.id)).toBe(true);
    expect(fs.existsSync(path.join(tmp, "vault", meta.path))).toBe(false);
    expect(await getNote(meta.id)).toBeNull();
  });

  it("rebuilds the index from disk", async () => {
    const count = await rebuildIndex();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("extracts outlinks", () => {
    expect(extractOutlinks("a [[One]] b [[Two|alias]] c [[One]]")).toEqual(["One", "Two"]);
  });
});
