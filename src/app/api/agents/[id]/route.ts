import { readCollection, updateCollection } from "@/lib/store";
import { withDb, parseBody } from "@/lib/route-helpers";
import { AgentPatchInput, type Agent, type AgentRun } from "@/lib/schemas";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const agents = await readCollection<Agent>("agents");
    const agent = agents.find((a) => a.id === id);
    if (!agent) throw new Error("Agent not found");
    const runs = (await readCollection<AgentRun>("runs")).filter((r) => r.agentId === id).slice(0, 25);
    return { agent, runs };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const patch = await parseBody(req, AgentPatchInput);
    const agents = await readCollection<Agent>("agents");
    const agent = agents.find((a) => a.id === id);
    if (!agent) throw new Error("Agent not found");
    const updated: Agent = { ...agent, ...patch, updatedAt: nowIso() };
    await updateCollection<Agent>("agents", (items) => items.map((a) => (a.id === id ? updated : a)));
    await audit({
      workspaceId: null,
      actorType: "user",
      actorId: "you",
      action: "agent.configure",
      targetType: "agent",
      targetId: id,
      details: `${agent.name}: ${Object.keys(patch).join(", ")}`,
    });
    return updated;
  });
}
