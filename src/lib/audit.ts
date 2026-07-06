import { updateCollection } from "./store";
import { newId, nowIso } from "./ids";
import type { AuditEvent } from "./schemas";

const MAX_EVENTS = 2000;

export async function audit(event: {
  workspaceId?: string | null;
  actorType: "user" | "agent" | "system";
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
}): Promise<AuditEvent> {
  const full: AuditEvent = {
    id: newId("audit"),
    workspaceId: event.workspaceId ?? null,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    details: event.details ?? "",
    createdAt: nowIso(),
  };
  await updateCollection<AuditEvent>("audit", (items) => {
    const next = [full, ...items];
    return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
  });
  return full;
}
