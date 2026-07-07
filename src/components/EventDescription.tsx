"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

/** Renders Google Calendar HTML descriptions safely. */
export default function EventDescription({ html, className = "" }: { html: string; className?: string }) {
  const safe = useMemo(() => {
    const trimmed = html.trim();
    if (!trimmed) return "";
    if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
      return DOMPurify.sanitize(trimmed.replace(/\n/g, "<br>"));
    }
    return DOMPurify.sanitize(trimmed, {
      FORBID_TAGS: ["style", "iframe", "form", "script"],
      FORBID_ATTR: ["onerror", "onclick", "onload"],
    });
  }, [html]);

  if (!safe) return null;
  return <div className={`prose-swos text-[13px] ${className}`} dangerouslySetInnerHTML={{ __html: safe }} />;
}
