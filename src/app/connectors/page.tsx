"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Calendar,
  ExternalLink,
  Mail,
  MessageCircle,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, Toggle } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/useApi";
import { useToast } from "@/components/toast";
import { CATEGORY_LABELS } from "@/lib/connector-catalog";
import type { ConnectorCategory, ConnectorView, Workspace } from "@/lib/schemas";

interface ConnectorsResponse {
  workspace: Workspace | null;
  connectors: ConnectorView[];
  google?: { clientIdSet: boolean; oauthReady: boolean; needsSecret: boolean; redirectUri: string };
}

const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  calendar: Calendar,
  outlook: Mail,
  slack: MessageCircle,
  discord: MessageCircle,
  message: MessageCircle,
  sparkles: Sparkles,
  box: Box,
  plug: Plug,
};

function ConnectorIcon({ icon }: { icon: string }) {
  const Icon = ICONS[icon] ?? Plug;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-soft">
      <Icon size={20} />
    </span>
  );
}

function statusBadge(binding: ConnectorView["binding"]) {
  if (!binding || binding.status === "disconnected") return <Badge status="idle">Not connected</Badge>;
  if (binding.status === "connected" && !binding.enabled) return <Badge status="disabled">Disabled</Badge>;
  if (binding.status === "connected") return <Badge status="ok">Connected</Badge>;
  if (binding.status === "error") return <Badge status="error">Error</Badge>;
  return <Badge status="pending">Coming soon</Badge>;
}

function ConnectorsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: active } = useApi<{ workspace: Workspace | null }>("/api/workspaces/active");
  const ws = active?.workspace;
  const { data, mutate } = useApi<ConnectorsResponse>(ws ? `/api/connectors?workspaceId=${ws.id}` : null);

  const [connectTarget, setConnectTarget] = useState<ConnectorView | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [label, setLabel] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google") {
      toast("success", "Google connected — Gmail and Calendar are ready.");
      mutate();
      window.history.replaceState({}, "", "/connectors");
    } else if (error) {
      toast("error", decodeURIComponent(error));
      window.history.replaceState({}, "", "/connectors");
    }
  }, [searchParams, toast, mutate]);


  const grouped = useMemo(() => {
    const map = new Map<ConnectorCategory, ConnectorView[]>();
    for (const c of data?.connectors ?? []) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [data?.connectors]);

  const connectApiKey = async (item: ConnectorView) => {
    if (!ws) return;
    setConnectingId(item.id);
    try {
      await api(`/api/connectors/${item.id}`, {
        method: "POST",
        body: { workspaceId: ws.id },
      });
      mutate();
      refresh("/api/connectors");
      toast("success", `${item.name} connected for ${ws.name}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnectingId(null);
    }
  };

  const openConnect = (item: ConnectorView) => {
    if (item.authType === "mcp" && item.configurable) {
      setConnectTarget(item);
      setServerUrl(item.binding?.config.serverUrl ?? "");
      setLabel(item.binding?.config.label ?? item.name);
      return;
    }
    if (item.authType === "api_key") {
      if (!item.configured) {
        toast("error", `Add ${item.envKey} to .env.local and restart the dev server.`);
        return;
      }
      void connectApiKey(item);
      return;
    }
    if (item.authType === "oauth2" && item.oauthProvider === "google") {
      if (data?.google?.needsSecret) {
        toast("error", "Add Google_Client_Secret to .env.local and restart the dev server.");
        return;
      }
      if (!item.configured) {
        toast("error", "Add Google_Client_ID and Google_Client_Secret to .env.local and restart the dev server.");
        return;
      }
      if (!ws) return;
      window.location.href = `/api/connectors/google/authorize?workspaceId=${ws.id}`;
      return;
    }
    toast("info", `${item.name} OAuth is coming in the next release.`);
  };

  const connect = async () => {
    if (!ws || !connectTarget) return;
    setConnecting(true);
    try {
      await api(`/api/connectors/${connectTarget.id}`, {
        method: "POST",
        body: { workspaceId: ws.id, config: { serverUrl, label } },
      });
      setConnectTarget(null);
      mutate();
      refresh("/api/connectors");
      toast("success", `${connectTarget.name} connected for ${ws.name}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (item: ConnectorView) => {
    if (!ws) return;
    setDisconnecting(item.id);
    try {
      await api(`/api/connectors/${item.id}`, {
        method: "DELETE",
        body: { workspaceId: ws.id },
      });
      mutate();
      refresh("/api/connectors");
      toast("success", `${item.name} disconnected`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(null);
    }
  };

  const toggleEnabled = async (item: ConnectorView, enabled: boolean) => {
    if (!ws) return;
    setToggling(item.id);
    try {
      await api(`/api/connectors/${item.id}`, {
        method: "PATCH",
        body: { workspaceId: ws.id, enabled },
      });
      mutate();
      refresh("/api/connectors");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setToggling(null);
    }
  };

  if (!ws) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader script="System" title="Connections" description="Connect external services and MCP servers per workspace." />
        <EmptyState icon={Plug} title="No workspace selected" hint="Choose or create a workspace from the sidebar switcher." />
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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        script="System"
        title="Connections"
        description={`Integrations for ${ws.name}. Enable connectors per workspace — agents will use connected tools when this phase wires them into the engine.`}
      />

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-mist-500">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const connected = item.binding?.status === "connected";
                return (
                  <Card key={item.id}>
                    <div className="flex gap-3">
                      <ConnectorIcon icon={item.icon} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-mist-100">{item.name}</h3>
                          {statusBadge(item.binding)}
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-mist-400">{item.description}</p>
                        {item.oauthProvider === "google" && item.id === "gmail" && (
                          <p className="mt-1.5 font-mono text-[11px] text-mist-500">
                            OAuth · Google_Client_ID {data?.google?.clientIdSet ? "✓" : "—"}
                            {data?.google?.needsSecret ? " · needs Google_Client_Secret" : data?.google?.oauthReady ? " · ready" : ""}
                          </p>
                        )}
                        {item.oauthProvider === "google" && item.id === "gmail" && data?.google?.oauthReady && !connected && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-gold">
                            Register this redirect URI in Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs:
                            <span className="mt-1 block break-all font-mono text-[10.5px] text-mist-300">
                              {data.google.redirectUri}
                            </span>
                          </p>
                        )}
                        {connected && item.binding?.config.email && (
                          <p className="mt-1.5 text-[11px] text-mist-500">{item.binding.config.email}</p>
                        )}
                        {item.authType === "api_key" && (
                          <p className="mt-1.5 font-mono text-[11px] text-mist-500">
                            env: {item.envKey} · {item.configured ? "key found" : "no key"}
                          </p>
                        )}
                        {connected && item.binding?.config.botUsername && (
                          <p className="mt-1.5 text-[11px] text-mist-500">Bot @{item.binding.config.botUsername}</p>
                        )}
                        {connected && item.binding?.config.serverUrl && (
                          <p className="mt-1.5 truncate font-mono text-[11px] text-mist-500">
                            {item.binding.config.serverUrl}
                          </p>
                        )}
                        {item.docsUrl && (
                          <a
                            href={item.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-indigo-soft hover:text-indigo-glow"
                          >
                            Documentation <ExternalLink size={11} />
                          </a>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {connected ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => disconnect(item)}
                                loading={disconnecting === item.id}
                              >
                                Disconnect
                              </Button>
                              <div className="ml-auto flex items-center gap-2">
                                <span className="text-[11px] text-mist-500">Enabled</span>
                                <Toggle
                                  checked={item.binding?.enabled ?? false}
                                  onChange={(v) => toggleEnabled(item, v)}
                                  label={`Enable ${item.name}`}
                                />
                              </div>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={Plug}
                              onClick={() => openConnect(item)}
                              loading={connectingId === item.id}
                              disabled={item.authType === "api_key" && !item.configured}
                            >
                              {item.authType === "mcp" ? "Configure" : "Connect"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Modal
        open={!!connectTarget}
        onClose={() => setConnectTarget(null)}
        title={connectTarget ? `Connect ${connectTarget.name}` : "Connect"}
      >
        <div className="space-y-4">
          <p className="text-[12.5px] text-mist-400">
            Point this workspace at an MCP server URL. Tools from the server will be available to agents once engine
            integration ships.
          </p>
          <Field label="Display name">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My MCP server" />
          </Field>
          <Field label="Server URL" hint="http://localhost:3001/mcp or your hosted MCP endpoint">
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://..."
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConnectTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={connect} loading={connecting} disabled={!serverUrl.trim()}>
              Save connection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


export default function ConnectorsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>}>
      <ConnectorsContent />
    </Suspense>
  );
}
