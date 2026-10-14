import type { Risk, Severity } from "@depscan/core";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "unknown"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  unknown: "Sin dato",
};

/** Colores por severidad; validados para contraste en claro y oscuro. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#b91c1c",
  high: "#ea580c",
  medium: "#d97706",
  low: "#16a34a",
  unknown: "#71717a",
};

export const RISK_LABEL: Record<Risk, string> = {
  red: "Riesgo alto",
  yellow: "Riesgo medio",
  green: "Sin riesgo relevante",
};

export const RISK_COLOR: Record<Risk, string> = {
  red: "#dc2626",
  yellow: "#d97706",
  green: "#16a34a",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
}

export function vulnUrl(id: string): string {
  return id.startsWith("CVE-")
    ? `https://nvd.nist.gov/vuln/detail/${id}`
    : `https://osv.dev/vulnerability/${id}`;
}
