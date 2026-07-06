import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { ensureSeeded } from "./seed";

/**
 * Shared API route plumbing: seeds on first touch, validates input with zod,
 * and converts thrown errors into structured JSON errors so the UI never
 * gets an opaque 500.
 */

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400, issues?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: message, issues }, { status });
}

export async function withDb<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    await ensureSeeded();
    const data = await fn();
    return ok(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return fail(first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", 400, err.issues);
    }
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const status = /not found/i.test(message) ? 404 : /denied|not allowed|disabled|access/i.test(message) ? 403 : 500;
    return fail(message, status);
  }
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ZodError([{ code: "custom", message: "Body must be valid JSON", path: [] }]);
  }
  return schema.parse(json);
}
