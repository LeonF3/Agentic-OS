import { describe, expect, it } from "vitest";
import { localDevAdapter, keyPresent } from "@/lib/adapters";
import type { Provider } from "@/lib/schemas";

const localProvider: Provider = {
  id: "local-dev",
  name: "Local Dev Adapter",
  kind: "local",
  envKey: "",
  defaultModel: "local-dev",
  defaultFor: [],
  note: "",
  createdAt: "",
  updatedAt: "",
};

describe("adapters", () => {
  it("local adapter is always 'configured'", () => {
    expect(keyPresent(localProvider)).toBe(true);
  });

  it("cloud provider without env key is not configured", () => {
    const p: Provider = { ...localProvider, id: "openrouter", kind: "openrouter", envKey: "SWOS_TEST_MISSING_KEY" };
    delete process.env.SWOS_TEST_MISSING_KEY;
    expect(keyPresent(p)).toBe(false);
    process.env.SWOS_TEST_MISSING_KEY = "x";
    expect(keyPresent(p)).toBe(true);
    delete process.env.SWOS_TEST_MISSING_KEY;
  });

  it("local dev adapter clearly labels itself and echoes structure", () => {
    const out = localDevAdapter({ system: "sys", prompt: "Plan my week\nFocus on shipping" });
    expect(out).toContain("Local Dev Adapter");
    expect(out).toContain("Plan my week");
    expect(out.toLowerCase()).toContain("next steps");
  });

  it("detects coding-shaped prompts", () => {
    const out = localDevAdapter({ system: "s", prompt: "Refactor the api function and add tests" });
    expect(out).toContain("implementation plan");
  });
});
