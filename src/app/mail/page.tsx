"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Plug } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { MailDetail, MailMessage, Workspace } from "@/lib/schemas";

interface MailResponse {
  connected: boolean;
  messages: MailMessage[];
}

function formatWhen(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
}

export default function MailPage() {
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data, mutate } = useApi<MailResponse>(ws ? `/api/mail?workspaceId=${ws.id}` : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useApi<MailDetail>(
    ws && selectedId ? `/api/mail/${selectedId}?workspaceId=${ws.id}` : null
  );

  if (!ws) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader script="Command" title="Mail" description="Gmail inbox for the active workspace." />
        <EmptyState icon={Mail} title="No workspace selected" hint="Choose a workspace from the sidebar." />
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
        <PageHeader script="Command" title="Mail" description={`Gmail for ${ws.name}.`} />
        <EmptyState
          icon={Mail}
          title="Gmail not connected"
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
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-6xl flex-col">
      <PageHeader script="Command" title="Mail" description={`Inbox for ${ws.name}`} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden !p-0">
          <div className="border-b border-white/8 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-mist-500">Inbox</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {data.messages.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12.5px] text-mist-500">No messages in inbox.</li>
            ) : (
              data.messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full border-b border-white/6 px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
                      selectedId === m.id ? "bg-white/8" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-[13px] ${m.unread ? "font-semibold text-mist-100" : "text-mist-200"}`}>
                        {m.subject}
                      </p>
                      {m.unread && <Badge status="active">new</Badge>}
                    </div>
                    <p className="truncate text-[11.5px] text-mist-500">{m.from}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-mist-500">{m.snippet}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-white/8 p-2">
            <Button size="sm" variant="ghost" onClick={() => mutate()}>Refresh</Button>
          </div>
        </Card>

        <Card className="min-h-0 overflow-y-auto">
          {!selectedId || !detail ? (
            <p className="py-12 text-center text-[13px] text-mist-500">Select a message to read.</p>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[16px] font-semibold text-mist-100">{detail.subject}</h2>
              <dl className="space-y-1 text-[12px] text-mist-400">
                <div><span className="text-mist-500">From: </span>{detail.from}</div>
                <div><span className="text-mist-500">To: </span>{detail.to}</div>
                <div><span className="text-mist-500">Date: </span>{formatWhen(detail.date)}</div>
              </dl>
              <pre className="whitespace-pre-wrap rounded-lg border border-white/8 bg-white/3 p-4 text-[13px] leading-relaxed text-mist-200">
                {detail.body || detail.snippet}
              </pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
