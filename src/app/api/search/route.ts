import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import { listNotes } from "@/lib/vault";
import type { Agent, Goal, StudioAsset, TaskCard } from "@/lib/schemas";

/** Global search across notes, tasks, goals, agents, and assets. */
export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    if (!q) return { results: [] };

    const [tasks, goals, agents, assets, notes] = await Promise.all([
      readCollection<TaskCard>("tasks"),
      readCollection<Goal>("goals"),
      readCollection<Agent>("agents"),
      readCollection<StudioAsset>("assets"),
      listNotes({ workspaceId, query: q }),
    ]);

    const results = [
      ...notes.slice(0, 8).map((n) => ({ kind: "note", id: n.id, title: n.title, subtitle: n.type, href: `/memory/${n.id}` })),
      ...tasks
        .filter((t) => (!workspaceId || t.workspaceId === workspaceId) && t.title.toLowerCase().includes(q))
        .slice(0, 6)
        .map((t) => ({ kind: "task", id: t.id, title: t.title, subtitle: `Kanban · ${t.column}`, href: `/kanban?task=${t.id}` })),
      ...goals
        .filter((g) => (!workspaceId || g.workspaceId === workspaceId) && g.title.toLowerCase().includes(q))
        .slice(0, 4)
        .map((g) => ({ kind: "goal", id: g.id, title: g.title, subtitle: `Goal · ${g.status}`, href: `/goals?goal=${g.id}` })),
      ...agents
        .filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
        .slice(0, 4)
        .map((a) => ({ kind: "agent", id: a.id, title: a.name, subtitle: a.role, href: `/agents/${a.id}` })),
      ...assets
        .filter((a) => (!workspaceId || a.workspaceId === workspaceId) && a.title.toLowerCase().includes(q))
        .slice(0, 4)
        .map((a) => ({ kind: "asset", id: a.id, title: a.title, subtitle: `Studio · ${a.type}`, href: `/studio` })),
    ];
    return { results };
  });
}
