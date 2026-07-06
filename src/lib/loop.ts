import { readCollection, updateCollection, readDoc, writeDoc } from "./store";
import { nowIso } from "./ids";
import { audit } from "./audit";
import { createNote, rebuildIndex } from "./vault";
import type { MemoryWrite, Settings, Workspace } from "./schemas";

/**
 * Layer VII — The Loop.
 * Flushes approved/auto memory writes into the Vault as structured markdown
 * notes, rebuilds the search index, and records loop status. Failed writes
 * stay in the queue marked `failed` for retry.
 */

export interface LoopStatus {
  lastRunAt: string | null;
  lastResult: { written: number; failed: number; skipped: number; indexed: number } | null;
  pending: number;
  failed: number;
}

export async function loopStatus(): Promise<LoopStatus> {
  const queue = await readCollection<MemoryWrite>("memory-queue");
  const doc = await readDoc<{ lastRunAt: string | null; lastResult: LoopStatus["lastResult"] }>("loop", {
    lastRunAt: null,
    lastResult: null,
  });
  return {
    lastRunAt: doc.lastRunAt,
    lastResult: doc.lastResult,
    pending: queue.filter((q) => q.status === "pending" || q.status === "auto" || q.status === "approved").length,
    failed: queue.filter((q) => q.status === "failed").length,
  };
}

export async function runLoop(actorId = "loop-agent"): Promise<LoopStatus> {
  const queue = await readCollection<MemoryWrite>("memory-queue");
  const workspaces = await readCollection<Workspace>("workspaces");
  const eligible = queue.filter((q) => q.status === "auto" || q.status === "approved" || q.status === "failed");

  let written = 0;
  let failed = 0;
  const updates = new Map<string, Partial<MemoryWrite>>();

  for (const item of eligible) {
    const ws = workspaces.find((w) => w.id === item.workspaceId);
    if (!ws) {
      updates.set(item.id, { status: "failed", error: "Workspace no longer exists", updatedAt: nowIso() });
      failed++;
      continue;
    }
    try {
      const tags = [...new Set([...item.tags, "loop"])];
      const meta = await createNote({
        workspaceId: ws.id,
        workspaceSlug: ws.slug,
        title: item.title,
        markdown: item.markdown,
        type: item.type,
        tags,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
      });
      updates.set(item.id, { status: "written", noteId: meta.id, error: null, updatedAt: nowIso() });
      written++;
    } catch (err) {
      updates.set(item.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Write failed",
        updatedAt: nowIso(),
      });
      failed++;
    }
  }

  await updateCollection<MemoryWrite>("memory-queue", (items) =>
    items.map((q) => (updates.has(q.id) ? { ...q, ...updates.get(q.id) } : q))
  );

  const indexed = await rebuildIndex();
  const result = {
    written,
    failed,
    skipped: queue.filter((q) => q.status === "pending").length,
    indexed,
  };
  await writeDoc("loop", { lastRunAt: nowIso(), lastResult: result });

  // reflect into settings for health screen
  const settings = await readDoc<Partial<Settings>>("settings", {});
  await writeDoc("settings", { ...settings, lastLoopRunAt: nowIso() });

  await audit({
    workspaceId: null,
    actorType: "system",
    actorId: actorId,
    action: "loop.run",
    targetType: "loop",
    targetId: "loop",
    details: `wrote ${written}, failed ${failed}, indexed ${indexed} notes`,
  });

  return loopStatus();
}
