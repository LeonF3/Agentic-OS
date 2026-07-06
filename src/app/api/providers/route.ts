import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import { keyPresent } from "@/lib/adapters";
import { getSettings } from "@/lib/modelrouter";
import type { AgentRun, Provider } from "@/lib/schemas";

export async function GET() {
  return withDb(async () => {
    const [providers, runs, settings] = await Promise.all([
      readCollection<Provider>("providers"),
      readCollection<AgentRun>("runs"),
      getSettings(),
    ]);
    return {
      providers: providers.map((p) => ({
        ...p,
        configured: keyPresent(p),
        recentCalls: runs.filter((r) => r.providerId === p.id).length,
      })),
      routingRules: settings.routingRules,
    };
  });
}
