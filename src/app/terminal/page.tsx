"use client";

import { useRef, useState } from "react";
import { TerminalSquare, Play, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/useApi";
import { useToast } from "@/components/toast";

interface TermEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  blocked?: boolean;
}

export default function TerminalPage() {
  const { toast } = useToast();
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<TermEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = async (cmd: string, confirmed = false) => {
    setRunning(true);
    setPendingConfirm(null);
    try {
      const result = await api<TermEntry & { requiresConfirm?: boolean; message?: string }>("/api/terminal", {
        body: { command: cmd, confirmed },
      });
      if (result.requiresConfirm) {
        setPendingConfirm(cmd);
        return;
      }
      setHistory((h) => [...h, { command: cmd, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, blocked: result.blocked }]);
      setCommand("");
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        script="Layer I"
        title="Terminal"
        description="Guard-railed shell scoped to the project folder. Read-only commands run directly; mutating commands need explicit confirmation; destructive patterns are blocked. Everything is audited."
      />

      <Card>
        <div ref={scrollRef} className="inset mb-3 h-[46vh] overflow-y-auto p-3 font-mono text-[12.5px]">
          {history.length === 0 && (
            <p className="text-mist-500">
              <TerminalSquare size={14} className="mr-1.5 inline" />
              Try <span className="text-mist-200">ls</span>, <span className="text-mist-200">git status</span>, or{" "}
              <span className="text-mist-200">node -v</span>. cwd: project root.
            </p>
          )}
          {history.map((h, i) => (
            <div key={i} className="mb-3">
              <div className="flex items-center gap-2 text-indigo-soft">
                <span className="text-mist-600">$</span> {h.command}
                {h.exitCode !== 0 && h.exitCode !== null && <span className="text-nova-soft">exit {h.exitCode}</span>}
                {h.blocked && <span className="text-nova-soft">blocked</span>}
              </div>
              {h.stdout && <pre className="mt-1 whitespace-pre-wrap text-mist-300">{h.stdout}</pre>}
              {h.stderr && <pre className="mt-1 whitespace-pre-wrap text-nova-soft">{h.stderr}</pre>}
            </div>
          ))}
        </div>

        {pendingConfirm && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-gold/35 bg-gold/8 px-3.5 py-2.5">
            <ShieldAlert size={16} className="shrink-0 text-gold" />
            <p className="flex-1 text-[12.5px] text-gold">
              <span className="font-mono">{pendingConfirm}</span> can modify state. Run it?
            </p>
            <Button size="sm" variant="primary" onClick={() => run(pendingConfirm, true)}>
              Run anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingConfirm(null)}>
              Cancel
            </Button>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (command.trim()) run(command.trim());
          }}
        >
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="$ command"
            className="font-mono"
            aria-label="Terminal command"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" variant="primary" icon={Play} loading={running}>
            Run
          </Button>
        </form>
      </Card>
    </div>
  );
}
