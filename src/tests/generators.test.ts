import { describe, expect, it } from "vitest";
import { generateSchemaDraft, suggestInternalLinks } from "@/lib/generators";
import { classifyCommand, resolveCwd } from "@/lib/terminal";
import type { SeoProject } from "@/lib/schemas";

const project: SeoProject = {
  id: "seo_x",
  workspaceId: "ws_x",
  domain: "example.com",
  description: "",
  keywords: [],
  pages: [
    { url: "/a", title: "Guide to widgets", status: "published", targetKeywords: ["widgets", "widget guide"] },
    { url: "/b", title: "Widget pricing", status: "planned", targetKeywords: ["widgets", "pricing"] },
    { url: "/c", title: "About us", status: "published", targetKeywords: ["company"] },
  ],
  schemaDrafts: [],
  internalLinks: [],
  createdAt: "",
  updatedAt: "",
};

describe("SEO generators", () => {
  it("generates Article JSON-LD for a page", () => {
    const draft = generateSchemaDraft(project, "/a");
    const parsed = JSON.parse(draft.json);
    expect(parsed["@type"]).toBe("Article");
    expect(parsed.url).toContain("example.com");
  });

  it("suggests internal links for shared keywords", () => {
    const links = suggestInternalLinks(project);
    expect(links.some((l) => l.from === "/a" && l.to === "/b")).toBe(true);
    expect(links.every((l) => l.anchor.length > 0)).toBe(true);
  });
});

describe("terminal guard rails", () => {
  it("blocks destructive commands", () => {
    expect(classifyCommand("sudo rm -rf /").blocked).toBe(true);
    expect(classifyCommand("rm -rf /").blocked).toBe(true);
    expect(classifyCommand("shutdown -h now").blocked).toBe(true);
  });

  it("classifies read-only commands", () => {
    expect(classifyCommand("ls -la").readOnly).toBe(true);
    expect(classifyCommand("git status").readOnly).toBe(true);
    expect(classifyCommand("npm install left-pad").readOnly).toBe(false);
    expect(classifyCommand("ls; rm file").readOnly).toBe(false);
  });

  it("restricts cwd to the project tree", () => {
    expect(resolveCwd(undefined)).toBe(process.cwd());
    expect(resolveCwd("/etc")).toBeNull();
    expect(resolveCwd("..")).toBeNull();
  });
});
