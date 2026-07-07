import { withDb, parseBody } from "@/lib/route-helpers";
import { RunInput } from "@/lib/schemas";
import { executeAgentRun } from "@/lib/engine";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return withDb(async () => {
    const { id } = await params;
    const input = await parseBody(req, RunInput);
    return executeAgentRun({
      agentId: id,
      workspaceId: input.workspaceId,
      input: input.input,
      taskType: input.taskType,
      providerId: input.providerId,
      title: input.title,
      skillIds: input.skillIds,
      taskId: input.taskId,
    });
  });
}
