"use client";

import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

/** Renders trusted-local markdown (vault notes, agent output) safely. */
export default function Markdown({ children, className = "" }: { children: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(children ?? "", { async: false, gfm: true, breaks: true }) as string;
    // Highlight [[wiki links]] after markdown parsing
    const withWiki = raw.replace(
      /\[\[([^\]]+)\]\]/g,
      '<span style="color:var(--color-indigo-soft);border-bottom:1px dashed rgba(170,182,255,0.5)">$1</span>'
    );
    return DOMPurify.sanitize(withWiki, { FORBID_TAGS: ["style", "iframe", "form"], FORBID_ATTR: ["onerror", "onclick"] });
  }, [children]);
  return <div className={`prose-swos ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
