import type { SeoProject } from "./schemas";

/**
 * Deterministic SEO generators — these are real transformations of the
 * project's own data (no model required, no fake output).
 */

export function generateSchemaDraft(project: SeoProject, pageUrl?: string): { title: string; json: string } {
  const page = project.pages.find((p) => p.url === pageUrl) ?? project.pages[0];
  const domain = project.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (page) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.title || page.url,
      url: page.url.startsWith("http") ? page.url : `https://${domain}${page.url.startsWith("/") ? "" : "/"}${page.url}`,
      keywords: page.targetKeywords.join(", "),
      publisher: {
        "@type": "Organization",
        name: domain,
        url: `https://${domain}`,
      },
      dateModified: new Date().toISOString().slice(0, 10),
    };
    return { title: `Article schema — ${page.title || page.url}`, json: JSON.stringify(schema, null, 2) };
  }
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: domain,
    url: `https://${domain}`,
    potentialAction: {
      "@type": "SearchAction",
      target: `https://${domain}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return { title: `WebSite schema — ${domain}`, json: JSON.stringify(schema, null, 2) };
}

export function suggestInternalLinks(
  project: SeoProject
): { from: string; to: string; anchor: string; reason: string }[] {
  const suggestions: { from: string; to: string; anchor: string; reason: string }[] = [];
  for (const page of project.pages) {
    for (const other of project.pages) {
      if (page.url === other.url) continue;
      const shared = page.targetKeywords.filter((k) =>
        other.targetKeywords.some((ok) => ok.toLowerCase() === k.toLowerCase())
      );
      if (shared.length > 0) {
        suggestions.push({
          from: page.url,
          to: other.url,
          anchor: shared[0],
          reason: `Both pages target "${shared[0]}" — cross-link to consolidate topical authority.`,
        });
        continue;
      }
      // keyword appears in the other page's title
      const titleHit = page.targetKeywords.find((k) => other.title.toLowerCase().includes(k.toLowerCase()));
      if (titleHit) {
        suggestions.push({
          from: other.url,
          to: page.url,
          anchor: titleHit,
          reason: `"${other.title}" mentions "${titleHit}", which ${page.url} targets.`,
        });
      }
    }
  }
  // dedupe by from→to
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = `${s.from}→${s.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function contentBriefPrompt(project: SeoProject, keyword: string): { system: string; prompt: string } {
  const related = project.keywords
    .filter((k) => k.keyword !== keyword)
    .slice(0, 8)
    .map((k) => k.keyword);
  return {
    system:
      "You are an SEO content strategist. Produce a concise, actionable content brief in markdown with: search intent, suggested title options, H2/H3 outline, entities to cover, internal link targets, and a meta description under 155 characters.",
    prompt: [
      `Domain/project: ${project.domain}`,
      `Primary keyword: ${keyword}`,
      related.length ? `Related tracked keywords: ${related.join(", ")}` : "",
      `Existing pages: ${project.pages.map((p) => p.url).join(", ") || "none yet"}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Notebook generation prompts by output kind. */
export function notebookPrompt(
  kind: "summary" | "podcast-outline" | "infographic-outline" | "repurpose-plan",
  title: string,
  sources: { title: string; content: string }[]
): { system: string; prompt: string } {
  const corpus = sources
    .map((s, i) => `--- Source ${i + 1}: ${s.title} ---\n${s.content.slice(0, 12000)}`)
    .join("\n\n");
  const systems: Record<typeof kind, string> = {
    summary:
      "You are a knowledge engine. Summarize the sources into key claims, notable facts, and open questions. Use markdown with clear headers.",
    "podcast-outline":
      "You are a podcast producer. Turn the sources into a two-host episode outline: cold open hook, 4-6 segments with talking points, and a closing takeaway. NotebookLM-compatible: keep segments self-contained.",
    "infographic-outline":
      "You are an information designer. Turn the sources into an infographic spec: headline, 5-7 data points or steps with one-line labels, suggested visual metaphor, and a footer CTA.",
    "repurpose-plan":
      "You are a content strategist. Produce a repurposing plan: 1 article angle, 3 social post hooks, 1 email angle, and 1 short-video script beat sheet — all grounded in the sources.",
  };
  return {
    system: systems[kind],
    prompt: `Notebook: ${title}\n\n${corpus || "No sources yet — state that sources are required and suggest what to add."}`,
  };
}
