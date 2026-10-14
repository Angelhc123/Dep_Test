import type { ScanReport, Severity } from "../domain/types.js";

const COLORS = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

const SEV_COLOR: Record<Severity, string> = {
  critical: COLORS.red + COLORS.bold,
  high: COLORS.red,
  medium: COLORS.yellow,
  low: COLORS.green,
  unknown: COLORS.dim,
};

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + "…" : s + " ".repeat(n - s.length);
}

/** Reporte de texto para la terminal (con colores ANSI opcionales). */
export function renderText(r: ScanReport, color = true): string {
  const c = (code: string, s: string) => (color ? `${code}${s}${COLORS.reset}` : s);
  const s = r.summary;
  const lines: string[] = [];
  const riskText = { red: "RIESGO ALTO", yellow: "RIESGO MEDIO", green: "SIN RIESGO RELEVANTE" }[s.risk];
  lines.push(c(COLORS.bold, `depscan ${r.scannerVersion} · ${r.target.name}`));
  lines.push(`Semáforo: ${c(COLORS[s.risk], `● ${riskText}`)}`);
  lines.push(
    `Dependencias: ${s.dependencies} (${s.direct} directas, ${s.transitive} transitivas, ${s.unresolved} sin versión) · Vulnerables: ${s.vulnerableDependencies}`,
  );
  lines.push(
    `Fallas únicas: ${(["critical", "high", "medium", "low", "unknown"] as Severity[])
      .map((k) => c(SEV_COLOR[k], `${k} ${s.bySeverity[k]}`))
      .join(" · ")}`,
  );
  lines.push("");

  if (r.findings.length) {
    lines.push(
      c(
        COLORS.bold,
        `${pad("SEVERIDAD", 10)} ${pad("PAQUETE", 32)} ${pad("VERSIÓN", 14)} ${pad("TIPO", 11)} ${pad("RECOMENDADA", 18)} IDS`,
      ),
    );
    for (const f of r.findings) {
      const d = f.dependency;
      const rec = f.remediation?.recommended ?? f.minSafeVersion;
      const breaking = f.remediation
        ? f.remediation.options.find((o) => o.version === rec)?.breaking
        : f.majorBump;
      const fix = rec ? `${rec}${breaking ? " (mayor)" : ""}` : "sin corrección";
      lines.push(
        [
          c(SEV_COLOR[f.maxSeverity], pad(f.maxSeverity, 10)),
          pad(`${d.name}${d.ecosystem === "PyPI" ? " (py)" : ""}`, 32),
          pad(d.resolved ?? "?", 14),
          pad(d.direct ? "directa" : "transitiva", 11),
          pad(fix, 18),
          f.vulnerabilities.map((v) => v.id).join(", "),
        ].join(" "),
      );
    }
  } else {
    lines.push(c(COLORS.green, "No se encontraron vulnerabilidades conocidas."));
  }

  if (r.warnings.length) {
    lines.push("", c(COLORS.yellow, "Advertencias:"));
    for (const w of r.warnings) lines.push(`  - ${w}`);
  }
  lines.push("", c(COLORS.dim, `Escaneado ${r.scannedAt} en ${(r.durationMs / 1000).toFixed(1)} s`));
  return lines.join("\n");
}
