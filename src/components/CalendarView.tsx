"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin, Plus } from "lucide-react";
import EventDescription from "@/components/EventDescription";
import { Badge, Button, Card, Field, Input, Modal, Textarea } from "@/components/ui";
import { api, refresh } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import {
  HOUR_END,
  HOUR_HEIGHT,
  HOUR_START,
  addDays,
  addMonths,
  addWeeks,
  eventColor,
  eventLayout,
  eventOnDay,
  formatDayNum,
  formatDayShort,
  formatEventRange,
  formatNavLabel,
  formatTime,
  isToday,
  monthGridDays,
  parseEventStart,
  startOfDay,
  startOfWeek,
  toDatetimeLocalValue,
  type CalendarViewMode,
} from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/schemas";

interface CalendarViewProps {
  workspaceId: string;
  workspaceName: string;
  events: CalendarEvent[];
  focusDate: Date;
  onFocusChange: (d: Date) => void;
  view: CalendarViewMode;
  onViewChange: (v: CalendarViewMode) => void;
  onRefresh: () => void;
}

const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const VIEW_MODES: CalendarViewMode[] = ["day", "week", "month", "agenda"];

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((ev) => eventOnDay(ev, day))
    .sort((a, b) => parseEventStart(a.start, a.allDay).getTime() - parseEventStart(b.start, b.allDay).getTime());
}

export default function CalendarView({
  workspaceId,
  workspaceName,
  events,
  focusDate,
  onFocusChange,
  view,
  onViewChange,
  onRefresh,
}: CalendarViewProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(focusDate), i)), [focusDate]);
  const monthDays = useMemo(() => monthGridDays(focusDate), [focusDate]);
  const focusMonth = focusDate.getMonth();

  const openCreate = (day?: Date) => {
    const base = day ?? focusDate;
    const startDate = new Date(base);
    if (view === "day" || day) startDate.setHours(new Date().getHours() + 1, 0, 0, 0);
    else startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);
    setStart(toDatetimeLocalValue(startDate));
    setEnd(toDatetimeLocalValue(endDate));
    setTitle("");
    setDescription("");
    setLocation("");
    setCreateOpen(true);
  };

  const create = async () => {
    if (!title.trim() || !start || !end) {
      toast("error", "Title, start, and end are required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/calendar/events", {
        method: "POST",
        body: { workspaceId, title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), description, location },
      });
      setCreateOpen(false);
      onRefresh();
      refresh("/api/calendar");
      toast("success", "Event created");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => {
    if (view === "day") onFocusChange(addDays(focusDate, -1));
    else if (view === "month") onFocusChange(addMonths(focusDate, -1));
    else onFocusChange(addWeeks(startOfWeek(focusDate), -1));
  };

  const goNext = () => {
    if (view === "day") onFocusChange(addDays(focusDate, 1));
    else if (view === "month") onFocusChange(addMonths(focusDate, 1));
    else onFocusChange(addWeeks(startOfWeek(focusDate), 1));
  };

  const goToday = () => {
    const today = new Date();
    if (view === "week" || view === "agenda") onFocusChange(startOfWeek(today));
    else onFocusChange(startOfDay(today));
  };

  const openDay = (day: Date) => {
    onFocusChange(startOfDay(day));
    onViewChange("day");
  };

  const renderTimeGrid = (day: Date, dayEvents: CalendarEvent[]) => {
    const allDay = dayEvents.filter((ev) => ev.allDay);
    const timed = dayEvents.filter((ev) => !ev.allDay);
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {allDay.length > 0 && (
          <div className="grid grid-cols-[52px_1fr] border-b border-white/8">
            <div className="flex items-center justify-end pr-2 text-[9px] uppercase tracking-wide text-mist-600">all-day</div>
            <div className="space-y-0.5 border-l border-white/6 p-1">
              {allDay.map((ev) => (
                <button key={ev.id} type="button" onClick={() => setSelected(ev)} className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium ${eventColor(ev.id)} ${selected?.id === ev.id ? "ring-1 ring-indigo-glow" : ""}`}>{ev.title}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid flex-1 grid-cols-[52px_1fr]">
          <div className="relative" style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-mist-600" style={{ top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}>
                {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </div>
            ))}
          </div>
          <div className={`relative border-l border-white/6 ${isToday(day) ? "bg-indigo-glow/5" : ""}`} style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }} />
            ))}
            {timed.map((ev) => {
              const layout = eventLayout(ev, day);
              if (!layout) return null;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelected(ev)}
                  className={`absolute inset-x-1 z-[1] overflow-hidden rounded border px-2 py-1 text-left text-[11px] leading-tight ${eventColor(ev.id)} ${selected?.id === ev.id ? "z-10 ring-1 ring-indigo-glow" : ""}`}
                  style={{ top: `${layout.top}%`, height: `${layout.height}%`, minHeight: 22 }}
                >
                  <span className="block truncate font-semibold">{ev.title}</span>
                  <span className="block truncate opacity-80">{formatTime(parseEventStart(ev.start, false))}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMain = () => {
    if (view === "day") {
      const day = startOfDay(focusDate);
      const dayEvents = eventsForDay(events, day);
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <button type="button" onClick={() => openCreate(day)} className={`border-b border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5 ${isToday(day) ? "bg-indigo-glow/10" : ""}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-mist-500">{formatDayShort(day)}</p>
            <p className={`text-[20px] font-semibold ${isToday(day) ? "text-indigo-soft" : "text-mist-100"}`}>{formatDayNum(day)}</p>
          </button>
          {renderTimeGrid(day, dayEvents)}
        </div>
      );
    }

    if (view === "month") {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-white/10 bg-ink-900/95 backdrop-blur-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} className="border-l border-white/6 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-mist-500 first:border-l-0">{label}</div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-6">
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === focusMonth;
              const dayEvents = eventsForDay(events, day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => openDay(day)}
                  className={`min-h-[88px] border-b border-l border-white/6 p-1.5 text-left transition-colors hover:bg-white/5 ${!inMonth ? "bg-white/[0.02]" : ""} ${isToday(day) ? "bg-indigo-glow/10" : ""}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${isToday(day) ? "bg-indigo-glow text-ink-950" : inMonth ? "text-mist-200" : "text-mist-600"}`}>{day.getDate()}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); setSelected(ev); }}
                        className={`block truncate rounded border px-1 py-px text-[9px] font-medium ${eventColor(ev.id)}`}
                      >
                        {!ev.allDay && <span className="opacity-75">{formatTime(parseEventStart(ev.start, false))} </span>}
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 && <span className="block text-[9px] text-mist-500">+{dayEvents.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (view === "agenda") {
      const days = view === "agenda" ? weekDays : weekDays;
      const groups = days.map((day) => ({ day, events: eventsForDay(events, day) })).filter((g) => g.events.length > 0);
      return (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {groups.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-mist-500">No events this week.</p>
          ) : (
            <div className="space-y-6">
              {groups.map(({ day, events: dayEvents }) => (
                <section key={day.toISOString()}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mist-500">
                    {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    {isToday(day) && <span className="ml-2"><Badge status="active">today</Badge></span>}
                  </h3>
                  <div className="space-y-2">
                    {dayEvents.map((ev) => (
                      <button key={ev.id} type="button" onClick={() => setSelected(ev)} className={`w-full rounded-xl border border-white/10 bg-white/4 p-3 text-left transition-colors hover:bg-white/7 ${selected?.id === ev.id ? "border-indigo-glow/40 bg-indigo-glow/10" : ""}`}>
                        <p className="text-[14px] font-semibold text-mist-100">{ev.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-mist-500"><Clock size={12} />{ev.allDay ? "All day" : formatEventRange(ev.start, ev.end, ev.allDay)}</p>
                        {ev.location && <p className="mt-1 flex items-center gap-1 text-[11.5px] text-mist-500"><MapPin size={12} />{ev.location}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      );
    }

    // week
    const weekEvents = events.filter((ev) => weekDays.some((day) => eventOnDay(ev, day)));
    const allDayByDay = weekDays.map((day) => weekEvents.filter((ev) => ev.allDay && eventOnDay(ev, day)));
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-20 grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/10 bg-ink-900/95 backdrop-blur-sm">
          <div />
          {weekDays.map((day) => (
            <button key={day.toISOString()} type="button" onClick={() => openDay(day)} className={`border-l border-white/8 px-2 py-2.5 text-center transition-colors hover:bg-white/5 ${isToday(day) ? "bg-indigo-glow/10" : ""}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-mist-500">{formatDayShort(day)}</p>
              <p className={`mt-0.5 text-[18px] font-semibold leading-none ${isToday(day) ? "text-indigo-soft" : "text-mist-100"}`}>{formatDayNum(day)}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/8">
          <div className="flex items-center justify-end pr-2 text-[9px] uppercase tracking-wide text-mist-600">all-day</div>
          {weekDays.map((day, i) => (
            <div key={day.toISOString()} className="min-h-[28px] space-y-0.5 border-l border-white/6 p-0.5">
              {allDayByDay[i].map((ev) => (
                <button key={ev.id} type="button" onClick={() => setSelected(ev)} className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium ${eventColor(ev.id)} ${selected?.id === ev.id ? "ring-1 ring-indigo-glow" : ""}`}>{ev.title}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-[52px_repeat(7,1fr)]">
          <div className="relative" style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-mist-600" style={{ top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}>
                {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </div>
            ))}
          </div>
          {weekDays.map((day) => {
            const timed = weekEvents.filter((ev) => !ev.allDay && eventOnDay(ev, day));
            return (
              <div key={day.toISOString()} className={`relative border-l border-white/6 ${isToday(day) ? "bg-indigo-glow/5" : ""}`} style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
                {HOURS.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }} />
                ))}
                {timed.map((ev) => {
                  const layout = eventLayout(ev, day);
                  if (!layout) return null;
                  return (
                    <button key={`${ev.id}-${day.toISOString()}`} type="button" onClick={() => setSelected(ev)} className={`absolute inset-x-0.5 z-[1] overflow-hidden rounded border px-1.5 py-0.5 text-left text-[10.5px] leading-tight ${eventColor(ev.id)} ${selected?.id === ev.id ? "z-10 ring-1 ring-indigo-glow" : ""}`} style={{ top: `${layout.top}%`, height: `${layout.height}%`, minHeight: 18 }}>
                      <span className="block truncate font-semibold">{ev.title}</span>
                      <span className="block truncate opacity-80">{formatTime(parseEventStart(ev.start, false))}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Previous" onClick={goPrev} />
          <Button size="sm" variant="subtle" onClick={goToday}>Today</Button>
          <Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Next" onClick={goNext} />
        </div>
        <h2 className="text-[15px] font-semibold text-mist-100">{formatNavLabel(focusDate, view)}</h2>
        <span className="text-[12px] text-mist-500">{workspaceName}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-white/12 p-0.5">
            {VIEW_MODES.map((mode) => (
              <button key={mode} type="button" onClick={() => onViewChange(mode)} className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${view === mode ? "bg-white/10 text-mist-100" : "text-mist-500 hover:text-mist-300"}`}>{mode}</button>
            ))}
          </div>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => openCreate()}>New event</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="flex min-h-0 flex-col overflow-hidden !p-0">{renderMain()}</Card>
        <Card className="flex min-h-0 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="text-[13px] text-mist-400">Select an event to view details</p>
              <p className="mt-1 text-[11.5px] text-mist-500">{view === "month" ? "Click a day to drill in, or an event chip" : "Click a day header to open day view"}</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <div className={`mb-3 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${eventColor(selected.id)}`}>Event</div>
              <h2 className="text-[17px] font-semibold leading-snug text-mist-100">{selected.title}</h2>
              <p className="mt-2 flex items-start gap-2 text-[12.5px] text-mist-400"><Clock size={14} className="mt-0.5 shrink-0" />{formatEventRange(selected.start, selected.end, selected.allDay)}</p>
              {selected.location && <p className="mt-2 flex items-start gap-2 text-[12.5px] text-mist-400"><MapPin size={14} className="mt-0.5 shrink-0" />{selected.location}</p>}
              {selected.description && <div className="mt-4 border-t border-white/8 pt-4"><EventDescription html={selected.description} /></div>}
              {selected.htmlLink && (
                <a href={selected.htmlLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-indigo-soft hover:text-indigo-glow">
                  Open in Google Calendar <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New event">
        <div className="space-y-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="End"><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

