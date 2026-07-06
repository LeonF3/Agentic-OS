import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { Agent, AgentRun } from "@/lib/schemas";

export async function GET() {
  return withDb(async () => {
    const [agents, runs] = await Promise.all([
      readCollection<Agent>("agents"),
      readCollection<AgentRun>("runs"),
    ]);
    return agents.map((a) => {
      const agentRuns = runs.filter((r) => r.agentId === a.id);
      const lastRun = agentRuns[0] ?? null;
      const running = agentRuns.some((r) => r.status === "running");
      return {
        ...a,
        status: a.status === "disabled" ? "disabled" : running ? "running" : a.status,
        runCount: agentRuns.length,
        lastRunAt: lastRun?.startedAt ?? null,
        lastRunStatus: lastRun?.status ?? null,
      };
    });
  });
}
