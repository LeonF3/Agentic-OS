import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { collectionFile, ensureDataDirs } from "./paths";

/**
 * File-backed JSON collection store.
 *
 * Every collection is a single JSON array on disk under .swos-data/.
 * Writes are atomic (tmp file + rename) and serialized per collection via a
 * promise-chain mutex kept on globalThis so Next.js dev-mode module reloads
 * don't spawn competing queues.
 */

type MutexMap = Map<string, Promise<unknown>>;

function mutexes(): MutexMap {
  const g = globalThis as { __swosMutexes?: MutexMap };
  if (!g.__swosMutexes) g.__swosMutexes = new Map();
  return g.__swosMutexes;
}

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const map = mutexes();
  const prev = map.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  map.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

async function atomicWrite(file: string, data: string): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, data, "utf8");
  await fsp.rename(tmp, file);
}

export async function readCollection<T>(name: string): Promise<T[]> {
  ensureDataDirs();
  const file = collectionFile(name);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = await fsp.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt file: preserve it for inspection rather than silently nuking data.
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      await fsp.copyFile(file, backup);
    } catch {
      /* best effort */
    }
    return [];
  }
}

export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  ensureDataDirs();
  await withLock(name, () => atomicWrite(collectionFile(name), JSON.stringify(items, null, 2)));
}

/** Read-modify-write under the collection lock. Returns the updated list. */
export async function updateCollection<T>(name: string, fn: (items: T[]) => T[] | Promise<T[]>): Promise<T[]> {
  ensureDataDirs();
  return withLock(name, async () => {
    const file = collectionFile(name);
    let items: T[] = [];
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(await fsp.readFile(file, "utf8"));
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
    }
    const next = await fn(items);
    await atomicWrite(file, JSON.stringify(next, null, 2));
    return next;
  });
}

/** Single-object documents (settings, loop state). */
export async function readDoc<T>(name: string, fallback: T): Promise<T> {
  ensureDataDirs();
  const file = collectionFile(name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(await fsp.readFile(file, "utf8")) as T) };
  } catch {
    return fallback;
  }
}

export async function writeDoc<T>(name: string, doc: T): Promise<void> {
  ensureDataDirs();
  await withLock(name, () => atomicWrite(collectionFile(name), JSON.stringify(doc, null, 2)));
}
