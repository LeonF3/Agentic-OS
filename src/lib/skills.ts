import path from "node:path";
import fsp from "node:fs/promises";
import matter from "gray-matter";
import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { skillsDir, ensureDir } from "./paths";
import { SkillNameSchema, type Skill, type SkillWithWorkspace, type Workspace } from "./schemas";

const MAX_SKILL_BODY = 80_000;
const MAX_SKILLS_PER_RUN = 8;

export interface ParsedSkillFile {
  name: string;
  description: string;
  body: string;
}

export interface ResolvedSkills {
  skills: Skill[];
  cleanInput: string;
  slashTokens: string[];
}

/** Parse SKILL.md frontmatter — name field matches Cursor skill format. */
export function parseSkillMarkdown(raw: string): ParsedSkillFile {
  const parsed = matter(raw);
  const name = SkillNameSchema.parse(String(parsed.data.name ?? "").trim());
  const description = String(parsed.data.description ?? "").trim();
  if (!description) throw new Error("SKILL.md requires a description in frontmatter");
  if (description.length > 1024) throw new Error("Skill description must be 1024 characters or less");
  const body = parsed.content.trim();
  if (!body) throw new Error("SKILL.md body is empty");
  if (body.length > MAX_SKILL_BODY) throw new Error("Skill body exceeds size limit");
  return { name, description, body };
}

export async function listSkills(workspaceId?: string): Promise<Skill[]> {
  let skills = await readCollection<Skill>("skills");
  if (workspaceId) skills = skills.filter((s) => s.workspaceId === workspaceId);
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSkillsWithWorkspaces(
  activeWorkspaceId?: string
): Promise<{ workspace: Skill[]; other: SkillWithWorkspace[] }> {
  const [skills, workspaces] = await Promise.all([
    readCollection<Skill>("skills"),
    readCollection<Workspace>("workspaces"),
  ]);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));

  const workspace = skills
    .filter((s) => s.workspaceId === activeWorkspaceId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const other = skills
    .filter((s) => s.workspaceId !== activeWorkspaceId)
    .map((s) => {
      const ws = wsMap.get(s.workspaceId);
      return {
        ...s,
        workspaceName: ws?.name ?? "Unknown",
        workspaceSlug: ws?.slug ?? "unknown",
      };
    })
    .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName) || a.name.localeCompare(b.name));

  return { workspace, other };
}

export async function getSkill(id: string): Promise<Skill | null> {
  const skills = await readCollection<Skill>("skills");
  return skills.find((s) => s.id === id) ?? null;
}

/** Parse leading slash tokens: /name or /workspace-slug/name */
function parseSlashTokens(input: string): { tokens: string[]; rest: string } {
  const tokens: string[] = [];
  let rest = input.trimStart();
  const tokenRe = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?/;

  while (rest.startsWith("/")) {
    const m = rest.match(tokenRe);
    if (!m) break;
    if (m[2]) tokens.push(`${m[1]}/${m[2]}`);
    else tokens.push(m[1]);
    rest = rest.slice(m[0].length).trimStart();
    if (tokens.length >= MAX_SKILLS_PER_RUN) break;
  }
  return { tokens, rest };
}

function findSkillByToken(
  token: string,
  activeWorkspaceId: string,
  workspaces: Workspace[],
  skills: Skill[]
): Skill | null {
  if (token.includes("/")) {
    const [wsSlug, name] = token.split("/", 2);
    const ws = workspaces.find((w) => w.slug === wsSlug);
    if (!ws) return null;
    return skills.find((s) => s.workspaceId === ws.id && s.name === name) ?? null;
  }
  return skills.find((s) => s.workspaceId === activeWorkspaceId && s.name === token) ?? null;
}

export async function resolveSkillsForRun(opts: {
  input: string;
  workspaceId: string;
  skillIds?: string[];
}): Promise<ResolvedSkills> {
  const [skills, workspaces] = await Promise.all([
    readCollection<Skill>("skills"),
    readCollection<Workspace>("workspaces"),
  ]);

  const { tokens, rest } = parseSlashTokens(opts.input);
  const resolved: Skill[] = [];
  const seen = new Set<string>();

  const add = (skill: Skill | null, label: string) => {
    if (!skill) throw new Error(`Unknown skill: ${label}`);
    if (seen.has(skill.id)) return;
    seen.add(skill.id);
    resolved.push(skill);
  };

  for (const token of tokens) {
    add(findSkillByToken(token, opts.workspaceId, workspaces, skills), `/${token}`);
  }

  for (const id of opts.skillIds ?? []) {
    const skill = skills.find((s) => s.id === id);
    add(skill ?? null, id);
  }

  if (resolved.length > MAX_SKILLS_PER_RUN) {
    throw new Error(`At most ${MAX_SKILLS_PER_RUN} skills per run`);
  }

  return { skills: resolved, cleanInput: rest || opts.input.trim(), slashTokens: tokens };
}

export function formatSkillsForSystem(skills: Skill[], workspaces: Workspace[]): string {
  if (!skills.length) return "";
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  return skills
    .map((s) => {
      const ws = wsMap.get(s.workspaceId);
      const label = ws ? `${s.name} (${ws.name})` : s.name;
      return `### Skill: ${label}\n${s.description}\n\n${s.body}`;
    })
    .join("\n\n---\n\n");
}

export async function uploadSkill(opts: {
  workspaceId: string;
  raw: string;
  originalName?: string;
}): Promise<Skill> {
  const workspaces = await readCollection<Workspace>("workspaces");
  const ws = workspaces.find((w) => w.id === opts.workspaceId);
  if (!ws) throw new Error("Workspace not found");

  const parsed = parseSkillMarkdown(opts.raw);
  const existing = (await readCollection<Skill>("skills")).filter(
    (s) => s.workspaceId === opts.workspaceId && s.name === parsed.name
  );
  if (existing.length > 0) {
    throw new Error(`Skill "/${parsed.name}" already exists in ${ws.name}`);
  }

  const now = nowIso();
  const rel = path.join(ws.slug, `${parsed.name}.md`);
  const dir = path.join(skillsDir(), ws.slug);
  ensureDir(dir);
  await fsp.writeFile(path.join(skillsDir(), rel), opts.raw, "utf8");

  const skill: Skill = {
    id: newId("skill"),
    workspaceId: opts.workspaceId,
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    filePath: rel,
    createdAt: now,
    updatedAt: now,
  };

  await updateCollection<Skill>("skills", (items) => [skill, ...items]);
  return skill;
}

export async function deleteSkill(id: string): Promise<void> {
  const skills = await readCollection<Skill>("skills");
  const skill = skills.find((s) => s.id === id);
  if (!skill) throw new Error("Skill not found");

  if (skill.filePath) {
    try {
      await fsp.unlink(path.join(skillsDir(), skill.filePath));
    } catch {
      /* file may already be gone */
    }
  }

  await updateCollection<Skill>("skills", (items) => items.filter((s) => s.id !== id));
}
