import { readCollection, updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import type {
  ConnectorCatalogItem,
  ConnectorView,
  WorkspaceConnector,
} from "./schemas";
import { CONNECTOR_CATALOG, CATEGORY_ORDER } from "./connector-catalog";
import { isConnectorConfigured } from "./connector-env";
import { verifyDiscordBot } from "./discord";
import { GOOGLE_CONNECTOR_IDS } from "./google-oauth";
import { disconnectGoogleConnectors } from "./google-connectors";

function catalogItem(connectorId: string): ConnectorCatalogItem {
  const item = CONNECTOR_CATALOG.find((c) => c.id === connectorId);
  if (!item) throw new Error("Unknown connector");
  return item;
}

export async function listConnectorsForWorkspace(workspaceId: string): Promise<ConnectorView[]> {
  const bindings = (await readCollection<WorkspaceConnector>("workspace-connectors")).filter(
    (b) => b.workspaceId === workspaceId
  );
  const byConnector = new Map(bindings.map((b) => [b.connectorId, b]));

  return CONNECTOR_CATALOG.map((item) => ({
    ...item,
    configured: isConnectorConfigured(item),
    binding: byConnector.get(item.id) ?? null,
  })).sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });
}

export async function setConnectorEnabled(
  workspaceId: string,
  connectorId: string,
  enabled: boolean
): Promise<WorkspaceConnector> {
  catalogItem(connectorId);
  const now = nowIso();
  let result: WorkspaceConnector | null = null;

  await updateCollection<WorkspaceConnector>("workspace-connectors", (items) => {
    const idx = items.findIndex((b) => b.workspaceId === workspaceId && b.connectorId === connectorId);
    if (idx >= 0) {
      const next = { ...items[idx], enabled, updatedAt: now };
      items[idx] = next;
      result = next;
      return items;
    }
    const created: WorkspaceConnector = {
      id: newId("conn"),
      workspaceId,
      connectorId,
      enabled,
      status: "disconnected",
      config: {},
      connectedAt: null,
      updatedAt: now,
    };
    result = created;
    return [created, ...items];
  });

  if (!result) throw new Error("Failed to update connector");
  await audit({
    workspaceId,
    actorType: "user",
    actorId: "you",
    action: enabled ? "connector.enable" : "connector.disable",
    targetType: "connector",
    targetId: connectorId,
    details: catalogItem(connectorId).name,
  });
  return result;
}

export async function connectConnector(
  workspaceId: string,
  connectorId: string,
  config: Record<string, string> = {}
): Promise<WorkspaceConnector> {
  const item = catalogItem(connectorId);
  const now = nowIso();

  let resolvedConfig = { ...config };
  let credentialRef: string | undefined;

  if (item.authType === "api_key") {
    if (!item.envKey) throw new Error(`${item.name} is missing an env key mapping`);
    const token = process.env[item.envKey]?.trim();
    if (!token) {
      throw new Error(`Add ${item.envKey} to .env.local and restart the dev server.`);
    }
    if (item.id === "discord") {
      const bot = await verifyDiscordBot(token);
      resolvedConfig = { botId: bot.id, botUsername: bot.username };
      credentialRef = item.envKey;
    } else {
      throw new Error(`${item.name} API key connect is not implemented yet`);
    }
  } else if (item.authType === "oauth2") {
    throw new Error(
      `${item.name} uses browser OAuth — click Connect on the Connections page to sign in with Google.`
    );
  } else if (item.id === "imessage") {
    throw new Error(`${item.name} is not available yet.`);
  }

  if (item.authType === "mcp") {
    const serverUrl = config.serverUrl?.trim();
    if (!serverUrl) throw new Error("MCP server URL is required");
    try {
      new URL(serverUrl);
    } catch {
      throw new Error("MCP server URL must be a valid http(s) URL");
    }
  }

  let result: WorkspaceConnector | null = null;
  await updateCollection<WorkspaceConnector>("workspace-connectors", (items) => {
    const idx = items.findIndex((b) => b.workspaceId === workspaceId && b.connectorId === connectorId);
    const binding: WorkspaceConnector = {
      id: idx >= 0 ? items[idx].id : newId("conn"),
      workspaceId,
      connectorId,
      enabled: true,
      status: "connected",
      config: item.authType === "mcp" ? { serverUrl: config.serverUrl!.trim(), label: config.label?.trim() ?? item.name } : resolvedConfig,
      credentialRef,
      connectedAt: now,
      updatedAt: now,
    };
    if (idx >= 0) {
      items[idx] = binding;
    } else {
      items.unshift(binding);
    }
    result = binding;
    return items;
  });

  if (!result) throw new Error("Failed to connect");
  await audit({
    workspaceId,
    actorType: "user",
    actorId: "you",
    action: "connector.connect",
    targetType: "connector",
    targetId: connectorId,
    details: item.name,
  });
  return result;
}

export async function disconnectConnector(workspaceId: string, connectorId: string): Promise<void> {
  catalogItem(connectorId);

  if (GOOGLE_CONNECTOR_IDS.includes(connectorId as (typeof GOOGLE_CONNECTOR_IDS)[number])) {
    await disconnectGoogleConnectors(workspaceId);
    return;
  }

  const now = nowIso();

  await updateCollection<WorkspaceConnector>("workspace-connectors", (items) =>
    items.map((b) =>
      b.workspaceId === workspaceId && b.connectorId === connectorId
        ? {
            ...b,
            status: "disconnected" as const,
            config: {},
            credentialRef: undefined,
            connectedAt: null,
            updatedAt: now,
          }
        : b
    )
  );

  await audit({
    workspaceId,
    actorType: "user",
    actorId: "you",
    action: "connector.disconnect",
    targetType: "connector",
    targetId: connectorId,
    details: catalogItem(connectorId).name,
  });
}
