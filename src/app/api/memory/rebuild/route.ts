import { withDb } from "@/lib/route-helpers";
import { rebuildIndex } from "@/lib/vault";
import { audit } from "@/lib/audit";

export async function POST() {
  return withDb(async () => {
    const count = await rebuildIndex();
    await audit({
      workspaceId: null,
      actorType: "user",
      actorId: "you",
      action: "vault.reindex",
      targetType: "vault",
      targetId: "vault",
      details: `${count} notes indexed`,
    });
    return { indexed: count };
  });
}
