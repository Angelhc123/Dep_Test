import type { Finding, Remediation, ScanReport, Severity } from "../domain/types.js";

const esc = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export const SEV_LABEL: Record<Severity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  unknown: "Sin dato",
};

export const RISK_LABEL = { red: "Riesgo alto", yellow: "Riesgo medio", green: "Sin riesgo relevante" };

export const OPTION_LABEL = {
  minimal: "Mínima segura",
  "same-major": "Más nueva sin cambio mayor",
  latest: "Más nueva segura",
} as const;

export function vulnLink(id: string): string {
  if (id.startsWith("CVE-")) return `https://nvd.nist.gov/vuln/detail/${id}`;
  return `https://osv.dev/vulnerability/${id}`;
}

const anchor = (f: Finding) =>
  `f-${f.dependency.ecosystem}-${f.dependency.name}-${f.dependency.resolved}`.replace(/[^\w-]/g, "_");

function fixCell(f: Finding): string {
  const rec = f.remediation?.recommended ?? f.minSafeVersion;
  if (!rec) return '<span class="muted">sin corrección</span>';
  const breaking = f.remediation
    ? f.remediation.options.find((o) => o.version === rec)?.breaking
    : f.majorBump;
  return `<code>${esc(rec)}</code>${breaking ? ' <span class="warn">salto mayor</span>' : ""}`;
}

function summaryRow(f: Finding): string {
  const d = f.dependency;
  return `<tr>
    <td><span class="dot ${f.risk}"></span></td>
    <td><a href="#${anchor(f)}"><strong>${esc(d.name)}</strong></a><div class="muted">${esc(d.ecosystem)} · ${esc(d.sourceFile)}</div></td>
    <td><code>${esc(d.resolved)}</code>${d.resolution === "registry-estimate" ? '<div class="warn">estimada</div>' : ""}</td>
    <td>${d.direct ? "Directa" : "Transitiva"}${d.dev ? ' <span class="tag">dev</span>' : ""}</td>
    <td><span class="sev ${f.maxSeverity}">${SEV_LABEL[f.maxSeverity]}</span> ${f.vulnerabilities.length} falla(s)</td>
    <td>${fixCell(f)}</td>
  </tr>`;
}

function remediationHtml(r: Remediation, f: Finding): string {
  const parts: string[] = [];
  const statusText = {
    upgrade: `Actualizar a <code>${esc(r.recommended)}</code>`,
    "no-fix": "No hay versión publicada libre de fallas conocidas",
    unknown: "No se pudo calcular una versión segura",
  }[r.status];
  parts.push(`<p class="rec ${r.status}"><strong>Recomendación:</strong> ${statusText}</p>`);

  if (r.options.length) {
    parts.push(
      `<table class="mini"><thead><tr><th>Opción</th><th>Versión</th><th>Compatibilidad</th></tr></thead><tbody>${r.options
        .map(
          (o) =>
            `<tr><td>${OPTION_LABEL[o.kind]}</td><td><code>${esc(o.version)}</code>${o.version === r.recommended ? " ★" : ""}</td><td>${o.breaking ? '<span class="warn">cambio de versión mayor</span>' : "compatible (misma versión mayor)"}</td></tr>`,
        )
        .join("")}</tbody></table>`,
    );
  }
  if (r.safeVersions.length) {
    parts.push(
      `<p><strong>Versiones seguras de ${esc(f.dependency.name)}</strong> (${r.totalSafeVersions}${r.verified ? ", verificadas contra todos los avisos del paquete" : ", lista parcial"}):</p><p class="versions">${r.safeVersions.map((v) => `<code>${esc(v)}</code>`).join(" ")}${r.totalSafeVersions > r.safeVersions.length ? ` <span class="muted">y ${r.totalSafeVersions - r.safeVersions.length} más antiguas</span>` : ""}</p>`,
    );
  }
  if (r.commands.length) {
    parts.push(
      `<p><strong>Cómo aplicarlo</strong></p><ol class="steps">${r.commands.map((c) => `<li>${esc(c.label)}<pre>${esc(c.command)}</pre></li>`).join("")}</ol>`,
    );
  }
  if (r.snippet) {
    parts.push(
      `<p><strong>Fragmento para <code>${esc(r.snippet.file)}</code></strong></p><pre>${esc(r.snippet.content)}</pre><p class="muted">${esc(r.snippet.note)}</p>`,
    );
  }
  if (r.mitigations.length) {
    parts.push(
      `<p><strong>Si vas a seguir usando la versión actual</strong> (medidas temporales, no reemplazan la actualización)</p><ul class="mitig">${r.mitigations
        .map(
          (m) =>
            `<li><strong>${esc(m.title)}</strong> <span class="muted">(${esc(m.vulnId)})</span><div class="pre-wrap">${esc(m.text)}</div></li>`,
        )
        .join("")}</ul>`,
    );
  }
  if (r.patches.length) {
    parts.push(
      `<p><strong>Parches de la corrección</strong></p><ul>${r.patches.map((p) => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a> <span class="muted">(${esc(p.vulnId)})</span></li>`).join("")}</ul>`,
    );
  }
  if (r.notes.length)
    parts.push(`<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`);
  return parts.join("\n");
}

function findingDetail(f: Finding): string {
  const d = f.dependency;
  const vulns = f.vulnerabilities
    .map(
      (v) => `<li>
        <span class="sev ${v.severity}">${SEV_LABEL[v.severity]}${v.cvss !== undefined ? ` ${v.cvss.toFixed(1)}` : ""}</span>
        <a href="${esc(vulnLink(v.id))}" target="_blank" rel="noopener">${esc(v.id)}</a> ${esc(v.summary)}
        <div class="muted">${v.aliases
          .filter((a) => a !== v.id)
          .map(esc)
          .join(
            ", ",
          )}${v.cwes?.length ? ` · ${v.cwes.map(esc).join(", ")}` : ""}${v.fixedIn.length ? ` · corregida en ${v.fixedIn.map(esc).join(", ")}` : " · sin corrección"}</div>
      </li>`,
    )
    .join("");
  return `<article class="finding" id="${anchor(f)}">
    <h3><span class="dot ${f.risk}"></span> ${esc(d.name)} <code>${esc(d.resolved)}</code> <span class="muted">${esc(d.ecosystem)}</span></h3>
    <p class="muted">${d.direct ? "Dependencia directa" : `Transitiva: ${esc(d.path.join(" › "))}${d.requiredBy ? ` (${esc(d.requiredBy.name)} pide "${esc(d.requiredBy.range)}")` : ""}`}${d.dev ? " · solo desarrollo" : ""} · ${esc(d.sourceFile)}</p>
    <h4>Vulnerabilidades</h4>
    <ul class="vulns">${vulns}</ul>
    <h4>Cómo resolverlo</h4>
    ${f.remediation ? remediationHtml(f.remediation, f) : `<p>Versión mínima segura: ${fixCell(f)}</p>`}
  </article>`;
}

/** Reporte HTML autocontenido (sin recursos externos), apto para adjuntar en CI e imprimir como PDF. */
export function renderHtml(r: ScanReport): string {
  const s = r.summary;
  const counts = (["critical", "high", "medium", "low", "unknown"] as Severity[])
    .map(
      (k) =>
        `<div class="card"><div class="n sev-${k}">${s.bySeverity[k]}</div><div>${SEV_LABEL[k]}</div></div>`,
    )
    .join("");
  const warnings = r.warnings.length
    ? `<section><h2>Advertencias</h2><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></section>`
    : "";
  const findings = r.findings.length
    ? `<section><h2>Resumen de hallazgos</h2><div class="table"><table><thead><tr><th></th><th>Paquete</th><th>Versión</th><th>Tipo</th><th>Severidad</th><th>Versión recomendada</th></tr></thead><tbody>${r.findings.map(summaryRow).join("")}</tbody></table></div></section>
       <section><h2>Detalle y soluciones</h2>${r.findings.map(findingDetail).join("")}</section>`
    : "<section><p>No se encontraron vulnerabilidades conocidas en las versiones analizadas.</p></section>";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>depscan · ${esc(r.target.name)}</title>
<style>
:root{--bg:#f7f7f5;--fg:#1b1b1b;--muted:#6b6b6b;--card:#fff;--line:#e3e3e0;--code:#f0f0ed;--red:#d93025;--yellow:#b77900;--green:#1e8e3e}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--muted:#9a9a9a;--card:#1f1f1f;--line:#333;--code:#2a2a2a}}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:1100px;margin:auto}h1{margin:0 0 4px}h2{margin-top:32px}h3{margin:0 0 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}h4{margin:16px 0 6px}a{color:inherit}
.muted{color:var(--muted);font-size:12px}.warn{color:var(--yellow);font-size:12px;font-weight:600}.tag{font-size:11px;background:var(--code);padding:0 4px;border-radius:3px}
code,pre{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:var(--code);border-radius:4px}code{padding:1px 4px}pre{padding:8px 10px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:4px 0}
.risk{display:inline-flex;gap:8px;align-items:center;padding:6px 12px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-weight:600}
.dot{display:inline-block;width:12px;height:12px;border-radius:50%;flex:none}.dot.red{background:var(--red)}.dot.yellow{background:var(--yellow)}.dot.green{background:var(--green)}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;min-width:100px}
.n{font-size:28px;font-weight:700}.sev-critical{color:var(--red)}.sev-high{color:#e8590c}.sev-medium{color:var(--yellow)}.sev-low{color:var(--green)}
.table{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
.mini{background:var(--card);border:1px solid var(--line);border-radius:6px;max-width:640px}
ul{margin:0;padding-left:18px}li{margin:3px 0}.sev{font-size:11px;font-weight:700;padding:1px 6px;border-radius:4px;color:#fff;background:#888;white-space:nowrap}
.sev.critical{background:var(--red)}.sev.high{background:#e8590c}.sev.medium{background:var(--yellow)}.sev.low{background:var(--green)}
.finding{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0;break-inside:avoid-page}
.rec{padding:8px 12px;border-radius:6px;border-left:4px solid var(--green);background:var(--code)}.rec.no-fix,.rec.unknown{border-left-color:var(--yellow)}
.versions code{display:inline-block;margin:2px 0}.pre-wrap{white-space:pre-wrap}.steps pre{margin:4px 0 8px}.notes{color:var(--muted)}
@media print{body{background:#fff;color:#000;padding:0}.card,.finding,.table{border-color:#ccc}a{text-decoration:none}.finding{page-break-inside:avoid}}
</style></head><body><main>
<h1>Reporte de dependencias vulnerables</h1>
<div class="muted">${esc(r.target.name)}${r.target.commit ? ` · commit ${esc(r.target.commit.slice(0, 12))}` : ""} · ${esc(new Date(r.scannedAt).toLocaleString("es"))} · depscan ${esc(r.scannerVersion)}</div>
<p><span class="risk"><span class="dot ${s.risk}"></span>${RISK_LABEL[s.risk]}</span></p>
<div class="cards">${counts}
<div class="card"><div class="n">${s.vulnerableDependencies}/${s.dependencies}</div><div>Dependencias vulnerables</div></div>
<div class="card"><div class="n">${s.direct}/${s.transitive}</div><div>Directas / transitivas</div></div></div>
${warnings}
${findings}
<section><h2>Limitaciones</h2><ul class="muted">
<li>Se reportan versiones con fallas conocidas; no se verifica si el código usa la función afectada.</li>
<li>Solo se detecta lo publicado en OSV/NVD a la fecha del escaneo. Las versiones "seguras" lo son respecto a los avisos conocidos hoy.</li>
<li>Las mitigaciones son medidas temporales genéricas; la solución definitiva es actualizar.</li>
<li>Sin lockfile la precisión baja (versiones estimadas o no determinables).</li></ul></section>
<p class="muted">Manifiestos: ${r.manifests.map(esc).join(", ") || "ninguno"} · Duración: ${(r.durationMs / 1000).toFixed(1)} s</p>
</main></body></html>`;
}
