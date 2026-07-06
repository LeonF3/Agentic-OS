import { exec } from "node:child_process";
import path from "node:path";
import { dataDir } from "./paths";

/**
 * Guard-railed terminal adapter.
 * - Blocks obviously destructive patterns outright.
 * - Classifies non-read-only commands as `requiresConfirm`; the client must
 *   send confirmed=true (the UI shows an explicit confirmation).
 * - cwd is restricted to the project directory tree.
 * - 15s timeout, 200KB output cap. Every execution is audited by the route.
 */

const BLOCKED = [
  /\brm\s+(-[a-z]*[rf][a-z]*\s+)*\/(?:\s|$)/i, // rm -rf /
  /\bsudo\b/i,
  /\bshutdown\b|\breboot\b/i,
  /\bmkfs\b|\bdd\s+if=/i,
  /\bchmod\s+777\s+\//i,
  />\s*\/dev\/(sd|disk)/i,
  /\bkillall\b/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb
];

const READ_ONLY_PREFIXES = [
  "ls", "pwd", "cat", "head", "tail", "wc", "echo", "date", "whoami", "uname",
  "node -v", "node --version", "npm -v", "npm --version", "npm ls", "which",
  "git status", "git log", "git diff", "git branch", "df", "du", "env | grep -c", "find",
];

export interface TerminalResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  blocked?: boolean;
  requiresConfirm?: boolean;
  message?: string;
}

export function classifyCommand(command: string): { blocked: boolean; readOnly: boolean; reason?: string } {
  const trimmed = command.trim();
  for (const pattern of BLOCKED) {
    if (pattern.test(trimmed)) return { blocked: true, readOnly: false, reason: "Destructive command blocked by policy" };
  }
  const readOnly = READ_ONLY_PREFIXES.some(
    (p) => trimmed === p || trimmed.startsWith(p + " ")
  ) && !/[;&|><]/.test(trimmed.replace(/\|\|/g, "")); // pipes/redirects escalate to confirm
  return { blocked: false, readOnly };
}

export function resolveCwd(requested?: string): string | null {
  const projectRoot = process.cwd();
  const dataRoot = dataDir();
  const target = requested ? path.resolve(projectRoot, requested) : projectRoot;
  if (target === projectRoot || target.startsWith(projectRoot + path.sep)) return target;
  if (target === dataRoot || target.startsWith(dataRoot + path.sep)) return target;
  return null;
}

export function runCommand(command: string, cwd: string): Promise<TerminalResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd, timeout: 15000, maxBuffer: 200 * 1024, env: { ...process.env, SWOS_TERMINAL: "1" } },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout.toString().slice(0, 200 * 1024),
          stderr: stderr.toString().slice(0, 50 * 1024),
          exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
        });
      }
    );
  });
}
