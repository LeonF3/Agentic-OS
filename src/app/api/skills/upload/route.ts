import { withDb } from "@/lib/route-helpers";
import { uploadSkill } from "@/lib/skills";
import { getSettings } from "@/lib/modelrouter";
import { audit } from "@/lib/audit";

const MAX_UPLOAD = 512 * 1024;

export async function POST(req: Request) {
  return withDb(async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Attach a SKILL.md file in the 'file' field");
    if (file.size > MAX_UPLOAD) throw new Error("Skill file exceeds 512KB limit");

    const settings = await getSettings();
    const workspaceId = (form.get("workspaceId") as string) || settings.activeWorkspaceId;
    const raw = await file.text();
    const skill = await uploadSkill({ workspaceId, raw, originalName: file.name });

    await audit({
      workspaceId,
      actorType: "user",
      actorId: "you",
      action: "skill.upload",
      targetType: "skill",
      targetId: skill.id,
      details: `/${skill.name} — ${skill.description.slice(0, 80)}`,
    });

    return skill;
  });
}
