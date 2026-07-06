"use client";

import useSWR, { mutate as globalMutate } from "swr";

/**
 * Client data layer. All reads go through SWR; all writes go through
 * `api()` which throws readable errors for toast display and revalidates
 * affected keys.
 */

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data as T;
}

export function useApi<T>(url: string | null, refreshMs?: number) {
  return useSWR<T>(url, fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}

export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown; formData?: FormData } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.formData ? "POST" : "GET"),
    headers: opts.formData ? undefined : opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data as T;
}

/** Revalidate every SWR key that starts with one of the prefixes. */
export function refresh(...prefixes: string[]): void {
  void globalMutate(
    (key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)),
    undefined,
    { revalidate: true }
  );
}
