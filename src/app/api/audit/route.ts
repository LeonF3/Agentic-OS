import { readCollection } from "@/lib/store";
import { withDb } from "@/lib/route-helpers";
import type { AuditEvent } from "@/lib/schemas";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    let events = await readCollection<AuditEvent>("audit");
    if (workspaceId) events = events.filter((e) => e.workspaceId === workspaceId || e.workspaceId === null);
    return events.slice(0, limit);
  });
}
