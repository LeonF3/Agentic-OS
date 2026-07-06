import path from "node:path";
import fs from "node:fs";

/** Root of all persistent SWOS data. Lives inside the project by default. */
export function dataDir(): string {
  const dir = process.env.SWOS_DATA_DIR || path.join(process.cwd(), ".swos-data");
  return dir;
}

export function vaultDir(): string {
  return path.join(dataDir(), "vault");
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

export function collectionFile(name: string): string {
  return path.join(dataDir(), `${name}.json`);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureDataDirs(): void {
  ensureDir(dataDir());
  ensureDir(vaultDir());
  ensureDir(uploadsDir());
}

/**
 * Resolve a relative path inside a base directory, refusing traversal.
 * Returns null when the resolved path escapes the base.
 */
export function safeJoin(base: string, ...segments: string[]): string | null {
  const resolved = path.resolve(base, ...segments);
  const normalizedBase = path.resolve(base);
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return resolved;
}
