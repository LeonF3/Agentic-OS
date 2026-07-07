/** Client-safe calendar date helpers. */

export const HOUR_START = 6;
export const HOUR_END = 22;
export const HOUR_HEIGHT = 48;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

export function parseEventStart(iso: string, allDay: boolean): Date {
  if (allDay) {
    const [y, m, day] = iso.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(iso);
}

export function parseEventEnd(iso: string, allDay: boolean): Date {
  if (allDay) {
    const [y, m, day] = iso.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return d;
  }
  return new Date(iso);
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function formatDayNum(d: Date): string {
  return String(d.getDate());
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDayFull(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export type CalendarViewMode = "day" | "week" | "month" | "agenda";

export function monthGridDays(focusDate: Date): Date[] {
  const first = startOfMonth(focusDate);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function formatNavLabel(focusDate: Date, view: CalendarViewMode): string {
  if (view === "day") return formatDayFull(focusDate);
  if (view === "month") return formatMonthYear(focusDate);
  return formatWeekRange(startOfWeek(focusDate));
}

export function computeFetchRange(focusDate: Date, view: CalendarViewMode): { timeMin: string; timeMax: string } {
  if (view === "month") {
    const gridStart = startOfWeek(startOfMonth(focusDate));
    const monthEnd = endOfMonth(focusDate);
    const gridEnd = addDays(startOfWeek(monthEnd), 6);
    return {
      timeMin: addDays(gridStart, -1).toISOString(),
      timeMax: addDays(gridEnd, 8).toISOString(),
    };
  }
  if (view === "day") {
    const day = startOfDay(focusDate);
    return {
      timeMin: addDays(day, -1).toISOString(),
      timeMax: addDays(day, 2).toISOString(),
    };
  }
  const weekStart = startOfWeek(focusDate);
  return {
    timeMin: addWeeks(weekStart, -1).toISOString(),
    timeMax: addDays(weekStart, 21).toISOString(),
  };
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `${weekStart.toLocaleDateString(undefined, { month: "long" })} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
  }
  return `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function formatEventRange(start: string, end: string, allDay: boolean): string {
  const s = parseEventStart(start, allDay);
  const e = parseEventEnd(end, allDay);
  if (allDay) {
    if (sameDay(s, e) || end === start) {
      return s.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (sameDay(s, e)) {
    return `${s.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(s)} – ${formatTime(e)}`;
  }
  return `${s.toLocaleString()} – ${e.toLocaleString()}`;
}

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function eventOnDay(ev: { start: string; end: string; allDay: boolean }, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const evStart = parseEventStart(ev.start, ev.allDay);
  const evEnd = parseEventEnd(ev.end, ev.allDay);
  if (ev.allDay) {
    const endExclusive = addDays(evEnd, 1);
    return evStart < dayEnd && endExclusive > dayStart;
  }
  return evStart < dayEnd && evEnd > dayStart;
}

export function eventLayout(
  ev: { start: string; end: string; allDay: boolean },
  day: Date
): { top: number; height: number } | null {
  if (ev.allDay) return null;
  const evStart = parseEventStart(ev.start, false);
  const evEnd = parseEventEnd(ev.end, false);
  const dayStart = startOfDay(day);
  const gridStart = new Date(dayStart);
  gridStart.setHours(HOUR_START, 0, 0, 0);
  const gridEnd = new Date(dayStart);
  gridEnd.setHours(HOUR_END, 0, 0, 0);

  const start = evStart < gridStart ? gridStart : evStart;
  const end = evEnd > gridEnd ? gridEnd : evEnd;
  if (end <= start) return null;

  const topMin = (start.getTime() - gridStart.getTime()) / 60000;
  const durMin = (end.getTime() - start.getTime()) / 60000;
  const totalMin = (HOUR_END - HOUR_START) * 60;
  return {
    top: (topMin / totalMin) * 100,
    height: Math.max((durMin / totalMin) * 100, 2.5),
  };
}

const EVENT_COLORS = [
  "bg-indigo-glow/25 border-indigo-glow/50 text-indigo-soft",
  "bg-violet-glow/25 border-violet-glow/50 text-violet-soft",
  "bg-cyan-glow/20 border-cyan-glow/40 text-cyan-glow",
  "bg-aurora/20 border-aurora/40 text-aurora",
  "bg-gold/20 border-gold/40 text-gold",
];

export function eventColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % EVENT_COLORS.length;
  return EVENT_COLORS[hash]!;
}
