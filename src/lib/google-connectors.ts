import { updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import type { WorkspaceConnector } from "./schemas";
import { GOOGLE_CONNECTOR_IDS } from "./google-oauth";
import { deleteGoogleToken } from "./google-tokens";

export async function markGoogleConnectorsConnected(
  workspaceId: string,
  config: Record<string, string>
): Promise<void> {
  const now = nowIso();
  await updateCollection<WorkspaceConnector>("workspace-connectors", (items) => {
    for (const connectorId of GOOGLE_CONNECTOR_IDS) {
      const idx = items.findIndex((b) => b.workspaceId === workspaceId && b.connectorId === connectorId);
      const binding: WorkspaceConnector = {
        id: idx >= 0 ? items[idx].id : newId("conn"),
        workspaceId,
        connectorId,
        enabled: true,
        status: "connected",
        config,
        credentialRef: "google-oauth",
        connectedAt: now,
        updatedAt: now,
      };
      if (idx >= 0) items[idx] = binding;
      else items.unshift(binding);
    }
    return items;
  });

  await audit({
    workspaceId,
    actorType: "user",
    actorId: "you",
    action: "connector.connect",
    targetType: "connector",
    targetId: "google",
    details: `Gmail + Calendar (${config.email ?? "Google account"})`,
  });
}

export async function disconnectGoogleConnectors(workspaceId: string): Promise<void> {
  const now = nowIso();
  await updateCollection<WorkspaceConnector>("workspace-connectors", (items) =>
    items.map((b) =>
      b.workspaceId === workspaceId && GOOGLE_CONNECTOR_IDS.includes(b.connectorId as (typeof GOOGLE_CONNECTOR_IDS)[number])
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
  await deleteGoogleToken(workspaceId);
  await audit({
    workspaceId,
    actorType: "user",
    actorId: "you",
    action: "connector.disconnect",
    targetType: "connector",
    targetId: "google",
    details: "Gmail + Calendar",
  });
}

export async function isGoogleConnected(workspaceId: string): Promise<boolean> {
  const { readCollection } = await import("./store");
  const bindings = await readCollection<WorkspaceConnector>("workspace-connectors");
  return bindings.some(
    (b) =>
      b.workspaceId === workspaceId &&
      b.connectorId === "gmail" &&
      b.status === "connected" &&
      b.enabled
  );
}
