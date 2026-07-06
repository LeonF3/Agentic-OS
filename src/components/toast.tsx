"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`panel flex items-start gap-2.5 px-3.5 py-2.5 text-sm shadow-xl backdrop-blur-xl ${
              t.kind === "error"
                ? "border-nova/50 text-nova-soft"
                : t.kind === "success"
                  ? "border-aurora/40 text-mist-100"
                  : "text-mist-100"
            }`}
          >
            {t.kind === "success" && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-aurora" />}
            {t.kind === "error" && <AlertTriangle size={16} className="mt-0.5 shrink-0 text-nova" />}
            {t.kind === "info" && <Info size={16} className="mt-0.5 shrink-0 text-indigo-soft" />}
            <span className="flex-1">{t.message}</span>
            <button
              aria-label="Dismiss"
              className="text-mist-500 hover:text-mist-100"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
