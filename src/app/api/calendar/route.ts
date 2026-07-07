import { withDb } from "@/lib/route-helpers";
import { listCalendarEvents } from "@/lib/google-calendar";
import { getSettings } from "@/lib/modelrouter";
import { isGoogleConnected } from "@/lib/google-connectors";

export async function GET(req: Request) {
  return withDb(async () => {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? (await getSettings()).activeWorkspaceId;
    const timeMin = url.searchParams.get("timeMin") ?? undefined;
    const timeMax = url.searchParams.get("timeMax") ?? undefined;
    const days = Number(url.searchParams.get("days") ?? "14");
    if (!workspaceId) return { connected: false, events: [] };
    const connected = await isGoogleConnected(workspaceId);
    if (!connected) return { connected: false, events: [] };
    const events = await listCalendarEvents(workspaceId, {
      timeMin,
      timeMax,
      days: Number.isFinite(days) ? days : 14,
    });
    return { connected: true, events };
  });
}
