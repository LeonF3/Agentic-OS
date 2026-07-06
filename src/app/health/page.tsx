"use client";

import { RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, ErrorState, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";

interface HealthCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

export default function HealthPage() {
  const { data, error, mutate, isValidating } = useApi<{
    checks: HealthCheck[];
    generatedAt: string;
    summary: { ok: number; warn: number; error: number };
  }>("/api/health", 30000);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        script="Layer I"
        title="System Health"
        description="Live checks — runtime, data layer, vault, providers, tools. Nothing here is static; every row is verified on load."
        actions={
          <Button icon={RefreshCw} onClick={() => mutate()} loading={isValidating}>
            Re-run checks
          </Button>
        }
      />

      {error && <ErrorState message={error.message} retry={() => mutate()} />}
      {!data && !error && <Spinner label="Running checks…" />}
      {data && (
        <>
          <div className="mb-4 flex gap-3">
            <Card className="flex-1 text-center">
              <div className="font-mono text-2xl font-bold text-aurora">{data.summary.ok}</div>
              <div className="label mt-1">Passing</div>
            </Card>
            <Card className="flex-1 text-center">
              <div className="font-mono text-2xl font-bold text-gold">{data.summary.warn}</div>
              <div className="label mt-1">Warnings</div>
            </Card>
            <Card className="flex-1 text-center">
              <div className="font-mono text-2xl font-bold text-nova">{data.summary.error}</div>
              <div className="label mt-1">Failing</div>
            </Card>
          </div>

          <Card title={`Checks — generated ${timeAgo(data.generatedAt)}`}>
            <ul className="divide-y divide-white/6">
              {data.checks.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <Badge status={c.status === "ok" ? "ok" : c.status === "warn" ? "warn" : "error"} />
                  <span className="w-56 shrink-0 text-[13px] text-mist-100">{c.label}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-mist-500" title={c.detail}>
                    {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
