"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, FileText, KanbanSquare, Target, Bot, Image as ImageIcon, ArrowRight, type LucideIcon } from "lucide-react";
import { fetcher } from "@/lib/useApi";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SearchResult {
  kind: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const KIND_ICON: Record<string, LucideIcon> = {
  note: FileText,
  task: KanbanSquare,
  goal: Target,
  agent: Bot,
  asset: ImageIcon,
};

export default function CommandPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const data = await fetcher<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(data.results);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 180);
  }, [query]);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : nav;
  }, [query, nav]);

  const rows: Array<{ key: string; title: string; subtitle: string; href: string; icon: LucideIcon }> = [
    ...navMatches.map((n) => ({ key: `nav-${n.href}`, title: n.label, subtitle: "Go to screen", href: n.href, icon: n.icon })),
    ...results.map((r) => ({
      key: `${r.kind}-${r.id}`,
      title: r.title,
      subtitle: r.subtitle,
      href: r.href,
      icon: KIND_ICON[r.kind] ?? ArrowRight,
    })),
  ];

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-ink-950/70 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="panel w-full max-w-xl overflow-hidden bg-ink-900/95 shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3">
          <Search size={16} className="text-mist-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, rows.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              }
              if (e.key === "Enter" && rows[highlight]) go(rows[highlight].href);
            }}
            placeholder="Search notes, tasks, goals, agents, screens…"
            className="flex-1 bg-transparent text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none"
            aria-label="Search"
          />
          {searching && <span className="text-[10px] text-mist-500">searching…</span>}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-mist-500">
              {query ? "No matches — try a different term." : "Type to search across the whole OS."}
            </p>
          )}
          {rows.map((row, i) => (
            <button
              key={row.key}
              onClick={() => go(row.href)}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                i === highlight ? "bg-indigo-glow/14 text-mist-100" : "text-mist-300"
              }`}
            >
              <row.icon size={15} className={i === highlight ? "text-indigo-soft" : "text-mist-500"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{row.title}</span>
                <span className="block truncate text-[11px] text-mist-500">{row.subtitle}</span>
              </span>
              {i === highlight && <CornerDownLeft size={13} className="text-mist-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
