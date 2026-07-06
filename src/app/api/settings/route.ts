import { readDoc, writeDoc } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { SettingsPatchInput, type Settings } from "@/lib/schemas";
import { getSettings } from "@/lib/modelrouter";
import { dataDir, vaultDir } from "@/lib/paths";
import { audit } from "@/lib/audit";

export async function GET() {
  return withDb(async () => {
    const settings = await getSettings();
    return { ...settings, vaultPath: vaultDir(), dataPath: dataDir() };
  });
}

export async function PATCH(req: Request) {
  return withDb(async () => {
    const patch = await parseBody(req, SettingsPatchInput);
    const current = await readDoc<Partial<Settings>>("settings", {});
    const next = { ...current, ...patch };
    await writeDoc("settings", next);
    await audit({
      workspaceId: null,
      actorType: "user",
      actorId: "you",
      action: "settings.update",
      targetType: "settings",
      targetId: "settings",
      details: Object.keys(patch).join(", "),
    });
    return next;
  });
}
