"use client";

import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, type LucideIcon } from "lucide-react";

/* Buttons -------------------------------------------------------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "subtle", size = "md", loading, icon: Icon, className = "", children, disabled, ...rest },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap";
  const sizes = size === "sm" ? "text-xs px-2.5 py-1.5" : "text-sm px-3.5 py-2";
  const variants = {
    primary:
      "bg-gradient-to-br from-indigo-glow to-violet-glow text-ink-950 hover:brightness-110 active:brightness-95 shadow-[0_2px_12px_rgba(124,140,248,0.35)]",
    ghost: "text-mist-300 hover:text-mist-100 hover:bg-white/5 active:bg-white/10",
    danger: "bg-nova/15 text-nova-soft border border-nova/40 hover:bg-nova/25 active:bg-nova/30",
    subtle: "bg-white/6 text-mist-100 border border-white/12 hover:bg-white/10 hover:border-white/20 active:bg-white/14",
  } as const;
  return (
    <button ref={ref} className={`${base} ${sizes} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={14} className="spinner" /> : Icon ? <Icon size={size === "sm" ? 13 : 15} /> : null}
      {children}
    </button>
  );
});

/* Inputs ---------------------------------------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref
) {
  return <input ref={ref} className={`field text-sm ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", rows = 4, ...rest },
  ref
) {
  return <textarea ref={ref} rows={rows} className={`field text-sm resize-y min-h-[70px] ${className}`} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={`field text-sm appearance-none cursor-pointer [&>option]:bg-ink-900 [&>option]:text-mist-100 ${className}`} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mist-500">{hint}</span>}
    </label>
  );
}

/* Badges / status -------------------------------------------------------- */

const badgeColors: Record<string, string> = {
  ok: "bg-aurora/15 text-aurora border-aurora/30",
  complete: "bg-aurora/15 text-aurora border-aurora/30",
  active: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  running: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  written: "bg-aurora/15 text-aurora border-aurora/30",
  auto: "bg-indigo-soft/15 text-indigo-soft border-indigo-soft/30",
  approved: "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/30",
  idle: "bg-white/8 text-mist-400 border-white/15",
  pending: "bg-gold/15 text-gold border-gold/30",
  warn: "bg-gold/15 text-gold border-gold/30",
  blocked: "bg-nova/15 text-nova-soft border-nova/35",
  failed: "bg-nova/15 text-nova-soft border-nova/35",
  error: "bg-nova/15 text-nova-soft border-nova/35",
  rejected: "bg-white/8 text-mist-500 border-white/15",
  cancelled: "bg-white/8 text-mist-500 border-white/15",
  disabled: "bg-white/8 text-mist-500 border-white/15",
  urgent: "bg-nova/15 text-nova-soft border-nova/35",
  high: "bg-gold/15 text-gold border-gold/30",
  medium: "bg-indigo-soft/15 text-indigo-soft border-indigo-soft/30",
  low: "bg-white/8 text-mist-400 border-white/15",
  queued: "bg-gold/15 text-gold border-gold/30",
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const cls = badgeColors[status] ?? "bg-white/8 text-mist-400 border-white/15";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${cls}`}>
      {children ?? status}
    </span>
  );
}

/* Cards ------------------------------------------------------------------ */

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-[13.5px] font-semibold text-mist-100">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* Empty / loading states --------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 px-6 py-10 text-center">
      {Icon && <Icon size={22} className="text-mist-600" />}
      <p className="text-sm font-medium text-mist-300">{title}</p>
      {hint && <p className="max-w-sm text-xs text-mist-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-mist-500">
      <Loader2 size={16} className="spinner" />
      <span className="text-xs">{label ?? "Loading…"}</span>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-nova/30 bg-nova/8 px-6 py-8 text-center">
      <p className="text-sm text-nova-soft">{message}</p>
      {retry && (
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* Modal -------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // focus first focusable element
    setTimeout(() => {
      ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    }, 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/70 p-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={ref} className={`panel w-full ${wide ? "max-w-3xl" : "max-w-lg"} bg-ink-900/95 p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            Esc
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Delete",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-mist-300">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* Toggle --------------------------------------------------------------------- */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5.5 w-10 rounded-full border transition-colors duration-200 ${
        checked ? "border-indigo-glow/60 bg-indigo-glow/50" : "border-white/15 bg-white/8"
      }`}
      style={{ height: 22 }}
    >
      <span
        className={`absolute top-[2px] h-4 w-4 rounded-full bg-mist-100 transition-transform duration-200 ${
          checked ? "translate-x-[21px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
