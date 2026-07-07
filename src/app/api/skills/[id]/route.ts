import { withDb } from "@/lib/route-helpers";
import { deleteSkill, getSkill } from "@/lib/skills";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const skill = await getSkill(id);
    if (!skill) throw new Error("Skill not found");
    return skill;
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const skill = await getSkill(id);
    if (!skill) throw new Error("Skill not found");
    await deleteSkill(id);
    await audit({
      workspaceId: skill.workspaceId,
      actorType: "user",
      actorId: "you",
      action: "skill.delete",
      targetType: "skill",
      targetId: id,
      details: `/${skill.name}`,
    });
    return { deleted: true };
  });
}
