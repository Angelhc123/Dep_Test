import type { ReactNode } from "react";
import type { Risk, Severity } from "@depscan/core";
import { RISK_COLOR, RISK_LABEL, SEVERITY_COLOR, SEVERITY_LABEL } from "../lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function RiskBadge({ risk, large = false }: { risk: Risk; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white font-semibold dark:border-zinc-700 dark:bg-zinc-900 ${
        large ? "px-4 py-2 text-base" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <span
        className={`${large ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} rounded-full`}
        style={{ backgroundColor: RISK_COLOR[risk] }}
        aria-hidden
      />
      {RISK_LABEL[risk]}
    </span>
  );
}

export function SeverityBadge({ severity, score }: { severity: Severity; score?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: SEVERITY_COLOR[severity] }}
    >
      {SEVERITY_LABEL[severity]}
      {score !== undefined && <span className="font-medium opacity-90">{score.toFixed(1)}</span>}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200" />
      {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
    secondary:
      "border border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
    danger:
      "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Stat({ value, label, color }: { value: ReactNode; label: string; color?: string }) {
  return (
    <Card className="min-w-0">
      <div className="text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
    </Card>
  );
}
