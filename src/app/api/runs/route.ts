import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { AgentRun } from "@/lib/schemas";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    let runs = await readCollection<AgentRun>("runs");
    if (workspaceId) runs = runs.filter((r) => r.workspaceId === workspaceId);
    if (agentId) runs = runs.filter((r) => r.agentId === agentId);
    return runs.slice(0, limit);
  });
}
