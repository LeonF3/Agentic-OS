import { withDb, parseBody } from "@/lib/route-helpers";
import { createCalendarEvent } from "@/lib/google-calendar";
import { CalendarEventCreateInput } from "@/lib/schemas";

export async function POST(req: Request) {
  return withDb(async () => {
    const body = await parseBody(req, CalendarEventCreateInput);
    return createCalendarEvent(body.workspaceId, body);
  });
}
