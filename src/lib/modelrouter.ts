import { readCollection, readDoc } from "./store";
import { SettingsSchema } from "./schemas";
import type { Provider, Settings, TaskType } from "./schemas";
import { callProvider, keyPresent, type AdapterResult, type ChatTurn } from "./adapters";

/**
 * The Brain — model routing.
 * Resolves a task type to a provider using the routing rules in Settings,
 * falling back through configured providers to the Local Dev Adapter so the
 * OS always answers, clearly labeling degraded output.
 */

export interface RouteResolution {
  provider: Provider;
  requested: string;
  fallbackChain: string[];
}

export async function getSettings(): Promise<Settings> {
  const raw = await readDoc<Partial<Settings>>("settings", {});
  return SettingsSchema.parse({ activeWorkspaceId: "", ...raw });
}

export async function resolveRoute(taskType: TaskType, providerOverride?: string): Promise<RouteResolution> {
  const providers = await readCollection<Provider>("providers");
  const settings = await getSettings();
  const requestedId = providerOverride || settings.routingRules[taskType] || "openrouter";
  const chain: string[] = [];

  const byId = (id: string) => providers.find((p) => p.id === id);
  const local = byId("local-dev") ?? providers.find((p) => p.kind === "local");

  let candidate = byId(requestedId);
  chain.push(requestedId);
  if (!candidate || !keyPresent(candidate)) {
    // fall back to any configured provider that has a key
    const configured = providers.find((p) => p.kind !== "local" && keyPresent(p));
    if (configured) {
      candidate = configured;
      chain.push(configured.id);
    } else if (local) {
      candidate = local;
      chain.push(local.id);
    }
  }
  if (!candidate) throw new Error("No providers configured — data layer not seeded");
  return { provider: candidate, requested: requestedId, fallbackChain: chain };
}

export interface ModelCall {
  taskType: TaskType;
  system: string;
  prompt: string;
  history?: ChatTurn[];
  providerOverride?: string;
  dryRun?: boolean;
}

export interface ModelCallResult extends AdapterResult {
  providerId: string;
  providerName: string;
  requestedProviderId: string;
  durationMs: number;
}

export async function runModel(call: ModelCall): Promise<ModelCallResult> {
  const { provider, requested } = await resolveRoute(call.taskType, call.providerOverride);
  const started = Date.now();
  if (call.dryRun) {
    return {
      output: `**Dry run** — would route \`${call.taskType}\` to **${provider.name}** (model \`${provider.defaultModel}\`). No call made.`,
      model: provider.defaultModel,
      degraded: false,
      providerId: provider.id,
      providerName: provider.name,
      requestedProviderId: requested,
      durationMs: 0,
    };
  }
  const result = await callProvider(provider, {
    system: call.system,
    prompt: call.prompt,
    history: call.history,
  });
  return {
    ...result,
    providerId: result.degraded ? "local-dev" : provider.id,
    providerName: result.degraded ? "Local Dev Adapter (fallback)" : provider.name,
    requestedProviderId: requested,
    durationMs: Date.now() - started,
  };
}
