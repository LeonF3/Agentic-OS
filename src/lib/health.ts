import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dataDir, vaultDir, uploadsDir } from "./paths";
import { readCollection } from "./store";
import { getSettings } from "./modelrouter";
import { keyPresent } from "./adapters";
import { loopStatus } from "./loop";
import type { Provider } from "./schemas";

const pexec = promisify(execFile);

export interface HealthCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

export interface HealthReport {
  checks: HealthCheck[];
  generatedAt: string;
  summary: { ok: number; warn: number; error: number };
}

async function writableCheck(dir: string): Promise<boolean> {
  try {
    await fsp.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${Date.now()}`);
    await fsp.writeFile(probe, "ok");
    await fsp.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

async function binaryAvailable(bin: string): Promise<boolean> {
  try {
    await pexec("which", [bin]);
    return true;
  } catch {
    return false;
  }
}

export async function systemHealth(): Promise<HealthReport> {
  const checks: HealthCheck[] = [];
  const push = (id: string, label: string, ok: boolean | "warn", detail: string) =>
    checks.push({ id, label, status: ok === true ? "ok" : ok === "warn" ? "warn" : "error", detail });

  // Node version
  const major = Number(process.versions.node.split(".")[0]);
  push("node", "Node.js runtime", major >= 20 ? true : "warn", `v${process.versions.node} (requires 20+)`);

  // Data dirs
  const dd = dataDir();
  push("data-dir", "Workspace data (.swos-data)", await writableCheck(dd), dd);
  push("vault", "Memory vault", await writableCheck(vaultDir()), vaultDir());
  push("uploads", "Media uploads", await writableCheck(uploadsDir()), uploadsDir());

  // Collections parse
  const collections = ["workspaces", "agents", "providers", "tasks", "goals", "runs", "memory-queue", "audit"];
  let collectionsOk = 0;
  const details: string[] = [];
  for (const c of collections) {
    try {
      const items = await readCollection(c);
      collectionsOk++;
      details.push(`${c}:${items.length}`);
    } catch {
      details.push(`${c}:ERROR`);
    }
  }
  push(
    "collections",
    "Data collections",
    collectionsOk === collections.length,
    details.join("  ")
  );

  // Vault contents
  const vaultIndex = await readCollection<unknown>("vault-index");
  push("vault-index", "Vault search index", vaultIndex.length > 0 ? true : "warn", `${vaultIndex.length} notes indexed`);

  // Env / providers
  let providers: Provider[] = [];
  try {
    providers = await readCollection<Provider>("providers");
  } catch {
    /* covered above */
  }
  const configured = providers.filter((p) => p.kind !== "local" && keyPresent(p));
  push(
    "providers",
    "Model providers",
    configured.length > 0 ? true : "warn",
    configured.length > 0
      ? `${configured.length} configured: ${configured.map((p) => p.name).join(", ")}`
      : "No API keys found — running on the Local Dev Adapter (offline mode)"
  );

  // env file presence
  const envLocal = fs.existsSync(path.join(process.cwd(), ".env.local"));
  push("env", "Environment file (.env.local)", envLocal ? true : "warn", envLocal ? "Present" : "Not created yet — copy .env.example");

  // Settings + active workspace
  try {
    const settings = await getSettings();
    const workspaces = await readCollection<{ id: string; name: string }>("workspaces");
    const active = workspaces.find((w) => w.id === settings.activeWorkspaceId);
    push("settings", "Settings & active workspace", Boolean(active), active ? `Active: ${active.name}` : "Active workspace missing");
    push(
      "terminal-flag",
      "Terminal tool",
      settings.terminalEnabled ? true : "warn",
      settings.terminalEnabled ? "Enabled (guard-railed, audited)" : "Disabled in settings"
    );
    push(
      "loop-settings",
      "Loop automation",
      true,
      settings.autoWriteRunLogs ? "Run logs auto-write to Vault" : "All memory writes require approval"
    );
  } catch (err) {
    push("settings", "Settings & active workspace", false, err instanceof Error ? err.message : "unreadable");
  }

  // Loop status
  const loop = await loopStatus();
  push(
    "loop",
    "The Loop",
    loop.failed > 0 ? "warn" : true,
    loop.lastRunAt
      ? `Last run ${loop.lastRunAt} — ${loop.pending} queued, ${loop.failed} failed`
      : `Never run — ${loop.pending} write(s) queued`
  );

  // Tools on this machine
  push("git", "Git", await binaryAvailable("git"), "Used for project-aware agent workflows");
  if (process.platform === "darwin") {
    push("screenshot", "Screenshot (macOS screencapture)", await binaryAvailable("screencapture"), "Available for capture workflows");
  }
  push("shell", "Shell (zsh/bash)", (await binaryAvailable("zsh")) || (await binaryAvailable("bash")), "Backs the Terminal tool");

  const summary = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    error: checks.filter((c) => c.status === "error").length,
  };
  return { checks, generatedAt: new Date().toISOString(), summary };
}
