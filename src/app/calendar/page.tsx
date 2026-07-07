"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, Plug } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import CalendarView from "@/components/CalendarView";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { computeFetchRange, startOfDay, type CalendarViewMode } from "@/lib/calendar-utils";
import type { CalendarEvent, Workspace } from "@/lib/schemas";

interface CalendarResponse {
  connected: boolean;
  events: CalendarEvent[];
}

export default function CalendarPage() {
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<CalendarViewMode>("week");

  const range = useMemo(() => computeFetchRange(focusDate, view), [focusDate, view]);

  const calendarUrl = ws
    ? `/api/calendar?workspaceId=${ws.id}&timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`
    : null;

  const { data, mutate } = useApi<CalendarResponse>(calendarUrl);

  if (!ws) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader script="Command" title="Calendar" description="Google Calendar for the active workspace." />
        <EmptyState icon={CalendarIcon} title="No workspace selected" hint="Choose a workspace from the sidebar." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader script="Command" title="Calendar" description={`Google Calendar for ${ws.name}.`} />
        <EmptyState
          icon={CalendarIcon}
          title="Google Calendar not connected"
          hint="Connect Google from Connections — one sign-in enables both Gmail and Calendar."
          action={
            <Link href="/connectors">
              <Button variant="primary" icon={Plug}>Open Connections</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-1">
      <PageHeader script="Command" title="Calendar" description={`Schedule for ${ws.name}`} />
      <CalendarView
        workspaceId={ws.id}
        workspaceName={ws.name}
        events={data.events}
        focusDate={focusDate}
        onFocusChange={setFocusDate}
        view={view}
        onViewChange={setView}
        onRefresh={() => mutate()}
      />
    </div>
  );
}
