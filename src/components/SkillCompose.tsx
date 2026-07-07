"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Textarea } from "./ui";
import { useApi } from "@/lib/useApi";
import type { Skill, SkillWithWorkspace } from "@/lib/schemas";

interface SkillCatalog {
  workspace: Skill[];
  other: SkillWithWorkspace[];
}

interface SkillComposeProps {
  workspaceId: string | undefined;
  value: string;
  onChange: (value: string) => void;
  selectedSkillIds: string[];
  onSelectedSkillIdsChange: (ids: string[]) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function SkillCompose({
  workspaceId,
  value,
  onChange,
  selectedSkillIds,
  onSelectedSkillIdsChange,
  onKeyDown,
  rows = 3,
  placeholder,
  autoFocus,
}: SkillComposeProps) {
  const { data: catalog } = useApi<SkillCatalog>(
    workspaceId ? `/api/skills?workspaceId=${workspaceId}` : null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const attached = useMemo(() => {
    if (!catalog) return [];
    const all = [...catalog.workspace, ...catalog.other];
    return selectedSkillIds.map((id) => all.find((s) => s.id === id)).filter(Boolean) as (Skill | SkillWithWorkspace)[];
  }, [catalog, selectedSkillIds]);

  const slashSuggestions = useMemo(() => {
    if (!catalog || !menuOpen) return [];
    const q = menuFilter.toLowerCase();
    const local = catalog.workspace
      .filter((s) => !q || s.name.includes(q) || s.description.toLowerCase().includes(q))
      .map((s) => ({ skill: s, label: `/${s.name}`, hint: s.description }));
    const cross = catalog.other
      .filter(
        (s) =>
          !q ||
          s.name.includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.workspaceSlug.includes(q)
      )
      .map((s) => ({
        skill: s,
        label: `/${s.workspaceSlug}/${s.name}`,
        hint: `${s.workspaceName} — ${s.description}`,
      }));
    return [...local, ...cross].slice(0, 12);
  }, [catalog, menuOpen, menuFilter]);

  const handleChange = (next: string) => {
    onChange(next);
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? next.length;
    const before = next.slice(0, pos);
    const slashMatch = before.match(/(?:^|\s)\/([a-z0-9-]*)$/);
    if (slashMatch) {
      setMenuOpen(true);
      setMenuFilter(slashMatch[1] ?? "");
    } else {
      setMenuOpen(false);
      setMenuFilter("");
    }
  };

  const insertSlash = (label: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const replaced = before.replace(/(?:^|\s)\/[a-z0-9-]*$/, (m) => {
      const prefix = m.startsWith(" ") ? " " : "";
      return `${prefix}${label} `;
    });
    onChange(replaced + after);
    setMenuOpen(false);
    setMenuFilter("");
    requestAnimationFrame(() => el.focus());
  };

  const toggleAttach = (skill: Skill | SkillWithWorkspace) => {
    if (selectedSkillIds.includes(skill.id)) {
      onSelectedSkillIdsChange(selectedSkillIds.filter((id) => id !== skill.id));
    } else {
      onSelectedSkillIdsChange([...selectedSkillIds, skill.id]);
    }
  };

  return (
    <div className="space-y-2">
      {attached.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attached.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-glow/30 bg-indigo-glow/10 px-2 py-0.5 text-[11px] text-indigo-soft"
            >
              /{s.name}
              {"workspaceName" in s && s.workspaceName ? (
                <span className="text-mist-500">· {s.workspaceName}</span>
              ) : null}
              <button
                type="button"
                onClick={() => onSelectedSkillIdsChange(selectedSkillIds.filter((id) => id !== s.id))}
                className="text-mist-500 hover:text-mist-100"
                aria-label={`Remove ${s.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {menuOpen && slashSuggestions.length > 0 && (
          <ul className="panel absolute bottom-full left-0 right-0 z-20 mb-1 max-h-48 overflow-y-auto bg-ink-900/95 p-1 backdrop-blur-xl">
            {slashSuggestions.map(({ skill, label, hint }) => (
              <li key={skill.id}>
                <button
                  type="button"
                  onClick={() => insertSlash(label)}
                  className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-white/8"
                >
                  <span className="font-mono text-[12px] text-indigo-soft">{label}</span>
                  <span className="truncate text-[11px] text-mist-500">{hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {catalog && catalog.other.length > 0 && (
        <details className="rounded-lg border border-white/8 text-[12px]">
          <summary className="cursor-pointer px-3 py-2 text-mist-400">
            Attach skills from other workspaces ({catalog.other.length} available)
          </summary>
          <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-white/8 p-2">
            {catalog.other.map((s) => {
              const on = selectedSkillIds.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggleAttach(s)}
                    className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition ${
                      on ? "bg-indigo-glow/12 text-mist-100" : "hover:bg-white/5 text-mist-300"
                    }`}
                  >
                    <span>
                      <span className="font-mono text-indigo-soft">/{s.workspaceSlug}/{s.name}</span>
                      <span className="ml-2 text-mist-500">{s.workspaceName}</span>
                    </span>
                    <span className="truncate text-[11px] text-mist-500">{s.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
