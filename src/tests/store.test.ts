import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swos-store-"));
process.env.SWOS_DATA_DIR = tmp;

import { readCollection, writeCollection, updateCollection, readDoc, writeDoc } from "@/lib/store";

describe("JSON store", () => {
  beforeAll(() => {
    process.env.SWOS_DATA_DIR = tmp;
  });
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reads empty collection as []", async () => {
    expect(await readCollection("does-not-exist")).toEqual([]);
  });

  it("writes and reads back a collection", async () => {
    await writeCollection("things", [{ id: "a" }, { id: "b" }]);
    const items = await readCollection<{ id: string }>("things");
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("updateCollection is atomic under concurrency", async () => {
    await writeCollection<number>("counters", []);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => updateCollection<number>("counters", (items) => [...items, i]))
    );
    const items = await readCollection<number>("counters");
    expect(items).toHaveLength(20);
  });

  it("survives corrupt files without throwing", async () => {
    fs.writeFileSync(path.join(tmp, "broken.json"), "{not json");
    expect(await readCollection("broken")).toEqual([]);
  });

  it("read/write docs with fallback merge", async () => {
    expect(await readDoc("missing-doc", { a: 1 })).toEqual({ a: 1 });
    await writeDoc("doc1", { a: 2 });
    expect(await readDoc("doc1", { a: 1, b: 3 })).toEqual({ a: 2, b: 3 });
  });
});
