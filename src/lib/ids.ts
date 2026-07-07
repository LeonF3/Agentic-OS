import crypto from "node:crypto";

const PREFIXES = {
  workspace: "ws",
  agent: "ag",
  run: "run",
  task: "task",
  goal: "goal",
  note: "note",
  asset: "asset",
  notebook: "nb",
  seo: "seo",
  audit: "evt",
  queue: "mw",
  provider: "prov",
  chat: "chat",
  skill: "skill",
  conn: "conn",
  oauth: "oauth",
} as const;

export type IdKind = keyof typeof PREFIXES;

export function newId(kind: IdKind): string {
  return `${PREFIXES[kind]}_${crypto.randomBytes(6).toString("hex")}`;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "untitled"
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
