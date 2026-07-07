import { withDb } from "@/lib/route-helpers";
import { listSkillsWithWorkspaces } from "@/lib/skills";
import { getSettings } from "@/lib/modelrouter";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const settings = await getSettings();
    const activeId = workspaceId ?? settings.activeWorkspaceId;
    return listSkillsWithWorkspaces(activeId);
  });
}
