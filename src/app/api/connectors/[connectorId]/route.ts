import { withDb } from "@/lib/route-helpers";
import {
  connectConnector,
  disconnectConnector,
  setConnectorEnabled,
} from "@/lib/connectors";
import { ConnectorConnectInput, ConnectorPatchInput } from "@/lib/schemas";

type Params = { params: Promise<{ connectorId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  return withDb(async () => {
    const { connectorId } = await params;
    const body = ConnectorPatchInput.parse(await req.json());
    return setConnectorEnabled(body.workspaceId, connectorId, body.enabled);
  });
}

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { connectorId } = await params;
    const body = ConnectorConnectInput.parse(await req.json());
    return connectConnector(body.workspaceId, connectorId, body.config ?? {});
  });
}

export async function DELETE(req: Request, { params }: Params) {
  return withDb(async () => {
    const { connectorId } = await params;
    const body = ConnectorConnectInput.parse(await req.json());
    await disconnectConnector(body.workspaceId, connectorId);
    return { disconnected: true };
  });
}
