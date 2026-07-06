"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Bot, Target, KanbanSquare, Clapperboard, TrendingUp, NotebookPen,
  FolderKanban, Library, BrainCircuit, TerminalSquare, Settings, Activity,
  ScrollText, ChevronDown, Check, Plus, Search, Menu, RefreshCw,
} from "lucide-react";
import { ToastProvider, useToast } from "./toast";
import { api, refresh, useApi } from "@/lib/useApi";
import { Button, Input, Modal, Field, Textarea } from "./ui";
import CommandPalette from "./CommandPalette";
import type { Workspace } from "@/lib/schemas";

const NAV = [
  {
    group: "Command",
    items: [
      { href: "/", label: "Mission Control", icon: Sparkles },
      { href: "/agents", label: "Agent Roster", icon: Bot },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
    ],
  },
  {
    group: "Production",
    items: [
      { href: "/studio", label: "Studio", icon: Clapperboard },
      { href: "/seo", label: "SEO", icon: TrendingUp },
      { href: "/notebook", label: "Notebook", icon: NotebookPen },
      { href: "/workspace", label: "Workspace Buckets", icon: FolderKanban },
    ],
  },
  {
    group: "Mind",
    items: [
      { href: "/memory", label: "The Vault", icon: Library },
      { href: "/brain", label: "The Brain", icon: BrainCircuit },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/terminal", label: "Terminal", icon: TerminalSquare },
      { href: "/health", label: "System Health", icon: Activity },
      { href: "/audit", label: "Audit Log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface ActiveWs {
  activeWorkspaceId: string | null;
  workspace: Workspace | null;
}

function WorkspaceSwitcher() {
  const { toast } = useToast();
  const { data: active } = useApi<ActiveWs>("/api/workspaces/active");
  const { data: workspaces } = useApi<Workspace[]>("/api/workspaces");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const switchTo = async (id: string) => {
    try {
      await api("/api/workspaces/active", { method: "PUT", body: { workspaceId: id } });
      setOpen(false);
      refresh("/api");
      toast("success", `Switched to ${workspaces?.find((w) => w.id === id)?.name ?? "workspace"}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Switch failed");
    }
  };

  const create = async () => {
    if (!name.trim()) {
      toast("error", "Workspace name is required");
      return;
    }
    setSaving(true);
    try {
      const ws = await api<Workspace>("/api/workspaces", { body: { name, description } });
      await api("/api/workspaces/active", { method: "PUT", body: { workspaceId: ws.id } });
      setCreateOpen(false);
      setName("");
      setDescription("");
      refresh("/api");
      toast("success", `Workspace "${ws.name}" created and activated`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const current = active?.workspace;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-left transition hover:border-indigo-glow/40 hover:bg-white/8"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-ink-950"
          style={{ background: current?.color ?? "#7C8CF8" }}
        >
          {current?.name?.[0] ?? "…"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="label block">Workspace</span>
          <span className="block truncate text-[13px] font-semibold text-mist-100">
            {current?.name ?? "Loading…"}
          </span>
        </span>
        <ChevronDown size={14} className={`text-mist-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="panel absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden bg-ink-900/95 p-1.5 backdrop-blur-xl" role="listbox">
          {(workspaces ?? []).map((w) => (
            <button
              key={w.id}
              role="option"
              aria-selected={w.id === current?.id}
              onClick={() => switchTo(w.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-white/8 ${
                w.id === current?.id ? "bg-indigo-glow/12 text-mist-100" : "text-mist-300"
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: w.color }} />
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === current?.id && <Check size={13} className="text-indigo-soft" />}
            </button>
          ))}
          <div className="mt-1 border-t border-white/8 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-indigo-soft transition hover:bg-white/8"
            >
              <Plus size={13} /> New workspace
            </button>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New workspace">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Client X" maxLength={80} />
          </Field>
          <Field label="Description" hint="What lives in this workspace? Data, memory, tasks, and outputs stay separated per workspace.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={create} loading={saving}>Create workspace</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SystemStatusDot() {
  const { data } = useApi<{ summary: { ok: number; warn: number; error: number } }>("/api/health", 60000);
  const s = data?.summary;
  const color = !s ? "bg-mist-600" : s.error > 0 ? "bg-nova" : s.warn > 0 ? "bg-gold" : "bg-aurora";
  const label = !s ? "Checking…" : s.error > 0 ? `${s.error} failing` : s.warn > 0 ? `${s.warn} warnings` : "All systems go";
  return (
    <Link href="/health" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-mist-400 transition hover:bg-white/5 hover:text-mist-100">
      <span className={`pulse-dot h-2 w-2 rounded-full ${color}`} />
      {label}
    </Link>
  );
}

function LoopChip() {
  const { toast } = useToast();
  const { data, mutate } = useApi<{ pending: number; failed: number }>("/api/loop", 30000);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const res = await api<{ lastResult: { written: number; failed: number } | null }>("/api/loop", { method: "POST" });
      toast("success", `Loop complete — ${res.lastResult?.written ?? 0} note(s) written to the Vault`);
      mutate();
      refresh("/api/memory", "/api/loop", "/api/audit");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Loop failed");
    } finally {
      setRunning(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={running}
      title="Run the Loop: flush approved memory writes into the Vault and reindex"
      className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-xs text-mist-300 transition hover:border-indigo-glow/40 hover:text-mist-100 disabled:opacity-50"
    >
      <RefreshCw size={12} className={running ? "spinner" : ""} />
      Loop{data && data.pending > 0 ? ` · ${data.pending}` : ""}
      {data && data.failed > 0 && <span className="text-nova-soft">!{data.failed}</span>}
    </button>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMobileNav(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <Link href="/" className="flex items-center gap-2.5 px-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-glow via-violet-glow to-cyan-glow text-lg font-bold text-ink-950 shadow-[0_2px_16px_rgba(124,140,248,0.45)]">
          S
        </span>
        <span>
          <span className="block text-[14px] font-bold leading-tight tracking-tight">Sebastian&apos;s</span>
          <span className="accent-script block text-[15px] leading-tight">Wonderland OS</span>
        </span>
      </Link>

      <WorkspaceSwitcher />

      <nav className="flex-1 space-y-4">
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="label mb-1 px-2">{group.group}</div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                        active
                          ? "border border-indigo-glow/30 bg-indigo-glow/14 font-medium text-mist-100"
                          : "border border-transparent text-mist-400 hover:bg-white/5 hover:text-mist-100"
                      }`}
                    >
                      <item.icon size={16} className={active ? "text-indigo-soft" : ""} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <SystemStatusDot />
    </div>
  );

  return (
    <div className="flex h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-[228px] shrink-0 border-r border-white/8 bg-ink-950/60 lg:block">{sidebar}</aside>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-[80] lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
          <aside className="absolute bottom-0 left-0 top-0 w-[260px] border-r border-white/10 bg-ink-900" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top command bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/8 bg-ink-950/50 px-4 backdrop-blur">
          <button className="rounded-lg p-2 text-mist-400 hover:bg-white/5 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu size={18} />
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-left text-[13px] text-mist-500 transition hover:border-indigo-glow/40 sm:max-w-sm"
          >
            <Search size={14} />
            <span className="flex-1 truncate">Search everything…</span>
            <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-mist-500 sm:block">⌘K</kbd>
          </button>
          <div className="flex-1" />
          <LoopChip />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={NAV.flatMap((g) => g.items)} />
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ShellInner>{children}</ShellInner>
    </ToastProvider>
  );
}
