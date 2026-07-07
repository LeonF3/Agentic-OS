import type { Provider } from "./schemas";

/**
 * Provider adapters. Each takes a prompt and returns text.
 * Keys are read from the environment at call time and never persisted.
 * The local adapter is deterministic and clearly labels its output.
 */

export interface AdapterResult {
  output: string;
  model: string;
  degraded: boolean;
}

export function keyPresent(p: Provider): boolean {
  if (p.kind === "local") return true;
  return Boolean(p.envKey && process.env[p.envKey]);
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

interface CallOpts {
  system: string;
  prompt: string;
  history?: ChatTurn[];
  model?: string;
  timeoutMs?: number;
}

function buildUserPrompt(opts: CallOpts): string {
  if (!opts.history?.length) return opts.prompt;
  const transcript = opts.history
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n\n");
  return `${transcript}\n\nUser: ${opts.prompt}`;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (body as { error?: { message?: string } }).error?.message ?? `${res.status} ${res.statusText}`;
      throw new Error(`Provider error: ${msg}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiCompatible(baseUrl: string, apiKey: string, opts: CallOpts, model: string): Promise<string> {
  const history = (opts.history ?? []).map((t) => ({ role: t.role, content: t.content }));
  const body = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: opts.system }, ...history, { role: "user", content: opts.prompt }],
      }),
    },
    opts.timeoutMs ?? 60000
  );
  const choices = body.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, opts: CallOpts, model: string): Promise<string> {
  const history = (opts.history ?? []).map((t) => ({ role: t.role, content: t.content }));
  const body = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: opts.system,
        messages: [...history, { role: "user", content: opts.prompt }],
      }),
    },
    opts.timeoutMs ?? 60000
  );
  const content = body.content as Array<{ type: string; text?: string }> | undefined;
  return content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n") ?? "";
}

async function callGemini(apiKey: string, opts: CallOpts, model: string): Promise<string> {
  const history = (opts.history ?? []).map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
  const body = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [...history, { role: "user", parts: [{ text: opts.prompt }] }],
      }),
    },
    opts.timeoutMs ?? 60000
  );
  const candidates = body.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  return candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

/**
 * Deterministic offline adapter. Produces a genuinely useful structured
 * draft from the prompt — and is honest about what it is.
 */
export function localDevAdapter(opts: CallOpts): string {
  const prompt = buildUserPrompt(opts);
  const lines = prompt.trim().split(/\n+/).filter(Boolean);
  const firstLine = lines[0] ?? "Untitled task";
  const words = prompt.toLowerCase();
  const isCode = /code|bug|refactor|implement|api|function|test/.test(words);
  const isPlan = /plan|goal|strategy|roadmap|organize|break.*down/.test(words);
  const isContent = /write|article|post|content|blog|script|caption/.test(words);

  const kind = isCode ? "implementation plan" : isPlan ? "action plan" : isContent ? "content draft outline" : "structured response";

  const bullets = lines.slice(0, 6).map((l, i) => `${i + 1}. ${l.length > 110 ? l.slice(0, 110) + "…" : l}`);

  return [
    `> **Local Dev Adapter** — no API key configured for this route. This is a deterministic offline draft, not a model completion. Connect a provider in **The Brain** for live output.`,
    "",
    `## ${firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine}`,
    "",
    `**Detected shape:** ${kind}`,
    "",
    "### Restated input",
    ...bullets,
    "",
    "### Suggested next steps",
    "- Break this into 2–4 concrete kanban cards (Hermes can draft them).",
    "- Capture any decisions as a `Decision` note in the Vault.",
    isCode
      ? "- Define acceptance checks first, then implement smallest testable slice."
      : isContent
        ? "- Draft an outline, then expand section by section; save each pass to the workspace bucket."
        : "- Identify the single blocking unknown and resolve it before scheduling the rest.",
    "",
    "### Memory",
    "This run will be queued for the Vault so future runs start with this context.",
  ].join("\n");
}

export async function callProvider(provider: Provider, opts: CallOpts): Promise<AdapterResult> {
  const model = opts.model ?? provider.defaultModel;
  if (provider.kind === "local" || !keyPresent(provider)) {
    return { output: localDevAdapter(opts), model: "local-dev", degraded: provider.kind !== "local" };
  }
  const apiKey = process.env[provider.envKey] as string;
  let output: string;
  switch (provider.kind) {
    case "openrouter":
      output = await callOpenAiCompatible("https://openrouter.ai/api/v1", apiKey, opts, model);
      break;
    case "openai":
      output = await callOpenAiCompatible("https://api.openai.com/v1", apiKey, opts, model);
      break;
    case "xai":
      output = await callOpenAiCompatible("https://api.x.ai/v1", apiKey, opts, model);
      break;
    case "anthropic":
      output = await callAnthropic(apiKey, opts, model);
      break;
    case "gemini":
      output = await callGemini(apiKey, opts, model);
      break;
    default:
      output = localDevAdapter(opts);
  }
  if (!output.trim()) throw new Error("Provider returned an empty response");
  return { output, model, degraded: false };
}

/** Cheap connectivity test — returns latency or throws with a useful message. */
export async function testProvider(provider: Provider): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  if (provider.kind === "local") {
    return { ok: true, latencyMs: 0, message: "Local adapter is always available." };
  }
  if (!keyPresent(provider)) {
    return { ok: false, latencyMs: 0, message: `Missing ${provider.envKey} in .env.local` };
  }
  const started = Date.now();
  try {
    await callProvider(provider, {
      system: "Reply with the single word: ok",
      prompt: "ping",
      timeoutMs: 20000,
    });
    return { ok: true, latencyMs: Date.now() - started, message: "Connected" };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
