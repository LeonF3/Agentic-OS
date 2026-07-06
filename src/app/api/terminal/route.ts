import { z } from "zod";
import { withDb, parseBody } from "@/lib/route-helpers";
import { classifyCommand, resolveCwd, runCommand } from "@/lib/terminal";
import { getSettings } from "@/lib/modelrouter";
import { audit } from "@/lib/audit";

const TerminalInput = z.object({
  command: z.string().min(1, "Command is required").max(2000),
  cwd: z.string().max(500).optional(),
  confirmed: z.boolean().optional(),
});

export async function POST(req: Request) {
  return withDb(async () => {
    const input = await parseBody(req, TerminalInput);
    const settings = await getSettings();
    if (!settings.terminalEnabled) throw new Error("Terminal is disabled in Settings");

    const { blocked, readOnly, reason } = classifyCommand(input.command);
    if (blocked) {
      await audit({
        workspaceId: settings.activeWorkspaceId,
        actorType: "user",
        actorId: "you",
        action: "terminal.blocked",
        targetType: "terminal",
        targetId: "terminal",
        details: input.command.slice(0, 200),
      });
      return { ok: false, blocked: true, stdout: "", stderr: reason ?? "Blocked", exitCode: null };
    }
    if (!readOnly && !input.confirmed) {
      return {
        ok: false,
        requiresConfirm: true,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "This command can modify state. Confirm to run it.",
      };
    }
    const cwd = resolveCwd(input.cwd);
    if (!cwd) throw new Error("Working directory must stay inside the project folder");

    const result = await runCommand(input.command, cwd);
    await audit({
      workspaceId: settings.activeWorkspaceId,
      actorType: "user",
      actorId: "you",
      action: "terminal.exec",
      targetType: "terminal",
      targetId: "terminal",
      details: `${input.command.slice(0, 200)} → exit ${result.exitCode}`,
    });
    return result;
  });
}
