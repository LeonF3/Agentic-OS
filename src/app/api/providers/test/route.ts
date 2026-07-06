import { z } from "zod";
import { readCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { testProvider } from "@/lib/adapters";
import { audit } from "@/lib/audit";
import type { Provider } from "@/lib/schemas";

export async function POST(req: Request) {
  return withDb(async () => {
    const { providerId } = await parseBody(req, z.object({ providerId: z.string() }));
    const providers = await readCollection<Provider>("providers");
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) throw new Error("Provider not found");
    const result = await testProvider(provider);
    await audit({
      workspaceId: null,
      actorType: "user",
      actorId: "you",
      action: "provider.test",
      targetType: "provider",
      targetId: providerId,
      details: `${provider.name}: ${result.ok ? "ok" : result.message}`,
    });
    return result;
  });
}
