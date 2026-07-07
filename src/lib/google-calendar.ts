import type { CalendarEvent } from "./schemas";
import { getGoogleAccessToken } from "./google-tokens";

function parseEvent(item: {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): CalendarEvent | null {
  if (!item.id) return null;
  const startRaw = item.start?.dateTime ?? item.start?.date;
  const endRaw = item.end?.dateTime ?? item.end?.date;
  if (!startRaw || !endRaw) return null;
  return {
    id: item.id,
    title: item.summary ?? "(no title)",
    start: startRaw,
    end: endRaw,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    location: item.location ?? "",
    description: item.description ?? "",
    htmlLink: item.htmlLink,
  };
}

export async function listCalendarEvents(
  workspaceId: string,
  opts: { timeMin?: string; timeMax?: string; days?: number } = {}
): Promise<CalendarEvent[]> {
  const accessToken = await getGoogleAccessToken(workspaceId);
  const timeMin = opts.timeMin ?? new Date().toISOString();
  const timeMax =
    opts.timeMax ?? new Date(Date.now() + (opts.days ?? 14) * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load Google Calendar events");
  const data = (await res.json()) as { items?: unknown[] };
  return (data.items ?? [])
    .map((item) => parseEvent(item as Parameters<typeof parseEvent>[0]))
    .filter((e): e is CalendarEvent => e !== null);
}

export async function createCalendarEvent(
  workspaceId: string,
  input: { title: string; start: string; end: string; description?: string; location?: string }
): Promise<CalendarEvent> {
  const accessToken = await getGoogleAccessToken(workspaceId);
  const body = {
    summary: input.title,
    description: input.description ?? "",
    location: input.location ?? "",
    start: input.start.length === 10 ? { date: input.start } : { dateTime: input.start },
    end: input.end.length === 10 ? { date: input.end } : { dateTime: input.end },
  };
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create calendar event");
  const data = (await res.json()) as Parameters<typeof parseEvent>[0];
  const event = parseEvent(data);
  if (!event) throw new Error("Unexpected calendar response");
  return event;
}
