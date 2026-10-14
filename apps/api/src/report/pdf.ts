import PDFDocument from "pdfkit";
import type { Finding, ScanReport, Severity } from "@depscan/core";

const SEV_LABEL: Record<Severity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  unknown: "Sin dato",
};
const SEV_COLOR: Record<Severity, string> = {
  critical: "#b91c1c",
  high: "#ea580c",
  medium: "#b45309",
  low: "#15803d",
  unknown: "#6b7280",
};
const RISK = {
  red: { label: "Riesgo alto", color: "#dc2626" },
  yellow: { label: "Riesgo medio", color: "#d97706" },
  green: { label: "Sin riesgo relevante", color: "#16a34a" },
};
const OPTION_LABEL = {
  minimal: "Mínima segura",
  "same-major": "Más nueva sin cambio mayor",
  latest: "Más nueva segura",
};

const REPLACEMENTS: Record<string, string> = {
  "\u2192": "->",
  "\u21D2": "->",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u2605": "*",
  "\u25CF": "\u2022",
};
/** Caracteres fuera de Latin-1 que sí existen en WinAnsi (– — ‘ ’ “ ” • … › €). */
const WINANSI_EXTRA = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x203a, 0x20ac,
]);

function inWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (
    c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WINANSI_EXTRA.has(c)
  );
}

/** Las fuentes estándar de PDF usan WinAnsi: se reemplazan los caracteres que no existen ahí. */
function t(s: unknown): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const mapped = REPLACEMENTS[ch] ?? ch;
    out += [...mapped].every(inWinAnsi) ? mapped : "?";
  }
  return out;
}

const MARGIN = 48;

/** Genera el reporte en PDF (A4) con resumen, hallazgos y soluciones. */
export function renderPdf(r: ScanReport): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `depscan · ${r.target.name}`,
      Author: "depscan",
      Subject: "Reporte de dependencias vulnerables",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width - MARGIN * 2;
  const muted = (text: string, size = 9) =>
    doc.font("Helvetica").fontSize(size).fillColor("#6b7280").text(t(text), { width });
  const body = (text: string, size = 10) =>
    doc.font("Helvetica").fontSize(size).fillColor("#111827").text(t(text), { width });
  const heading = (text: string, size = 14) => {
    doc.moveDown(0.6).font("Helvetica-Bold").fontSize(size).fillColor("#111827").text(t(text), { width });
    doc.moveDown(0.2);
  };
  const ensureSpace = (h: number) => {
    if (doc.y + h > doc.page.height - MARGIN - 20) doc.addPage();
  };
  const code = (text: string) => {
    const h =
      doc
        .font("Courier")
        .fontSize(8.5)
        .heightOfString(t(text), { width: width - 16 }) + 10;
    ensureSpace(h);
    const y = doc.y;
    doc.rect(MARGIN, y, width, h).fill("#f3f4f6");
    doc
      .fillColor("#111827")
      .font("Courier")
      .fontSize(8.5)
      .text(t(text), MARGIN + 8, y + 5, { width: width - 16 });
    doc.x = MARGIN;
    doc.y = y + h + 4;
  };

  // Portada / resumen
  const s = r.summary;
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#111827")
    .text("Reporte de dependencias vulnerables", { width });
  muted(
    `${r.target.name}${r.target.commit ? ` · commit ${r.target.commit.slice(0, 12)}` : ""} · ${new Date(r.scannedAt).toLocaleString("es")} · depscan ${r.scannerVersion}`,
  );
  doc.moveDown(0.8);
  const risk = RISK[s.risk];
  doc.circle(MARGIN + 7, doc.y + 7, 7).fill(risk.color);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(risk.color)
    .text(risk.label, MARGIN + 22, doc.y, { width });
  doc.x = MARGIN;
  doc.moveDown(0.6);

  const stats: [string, string, string?][] = [
    ...(["critical", "high", "medium", "low", "unknown"] as Severity[]).map(
      (k) => [String(s.bySeverity[k]), SEV_LABEL[k], SEV_COLOR[k]] as [string, string, string],
    ),
    [`${s.vulnerableDependencies}/${s.dependencies}`, "Vulnerables"],
    [`${s.direct}/${s.transitive}`, "Directas/transitivas"],
  ];
  const boxW = width / stats.length;
  const top = doc.y;
  stats.forEach(([n, label, color], i) => {
    const x = MARGIN + i * boxW;
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(color ?? "#111827")
      .text(n, x, top, { width: boxW - 4 });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#6b7280")
      .text(t(label), x, top + 20, { width: boxW - 4 });
  });
  doc.x = MARGIN;
  doc.y = top + 42;

  if (r.warnings.length) {
    heading("Advertencias", 12);
    for (const w of r.warnings) body(`• ${w}`, 9);
  }

  // Tabla resumen
  if (r.findings.length) {
    heading("Resumen de hallazgos", 12);
    const cols = [
      { title: "Paquete", w: 0.32 },
      { title: "Versión", w: 0.14 },
      { title: "Tipo", w: 0.14 },
      { title: "Severidad", w: 0.18 },
      { title: "Recomendada", w: 0.22 },
    ];
    const row = (cells: string[], bold = false, color?: string) => {
      const heights = cells.map((c, i) =>
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(8.5)
          .heightOfString(t(c), { width: cols[i]!.w * width - 6 }),
      );
      const h = Math.max(...heights) + 6;
      ensureSpace(h);
      const y = doc.y;
      let x = MARGIN;
      cells.forEach((c, i) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(8.5)
          .fillColor(i === 3 && color ? color : "#111827")
          .text(t(c), x + 3, y + 3, { width: cols[i]!.w * width - 6 });
        x += cols[i]!.w * width;
      });
      doc
        .moveTo(MARGIN, y + h)
        .lineTo(MARGIN + width, y + h)
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .stroke();
      doc.x = MARGIN;
      doc.y = y + h;
    };
    row(
      cols.map((c) => c.title),
      true,
    );
    for (const f of r.findings) {
      const d = f.dependency;
      const rec = f.remediation?.recommended ?? f.minSafeVersion;
      row(
        [
          `${d.name} (${d.ecosystem})`,
          d.resolved ?? "?",
          `${d.direct ? "Directa" : "Transitiva"}${d.dev ? " · dev" : ""}`,
          `${SEV_LABEL[f.maxSeverity]} · ${f.vulnerabilities.length} falla(s)`,
          rec ?? "sin corrección",
        ],
        false,
        SEV_COLOR[f.maxSeverity],
      );
    }

    doc.addPage();
    heading("Detalle y soluciones", 16);
    for (const f of r.findings) findingSection(f);
  } else {
    heading("Hallazgos", 12);
    body("No se encontraron vulnerabilidades conocidas en las versiones analizadas.");
  }

  function findingSection(f: Finding) {
    const d = f.dependency;
    ensureSpace(120);
    doc.moveDown(0.5);
    const y = doc.y;
    doc.rect(MARGIN, y, 4, 16).fill(RISK[f.risk].color);
    doc
      .font("Helvetica-Bold")
      .fontSize(12.5)
      .fillColor("#111827")
      .text(t(`${d.name} ${d.resolved ?? ""}`), MARGIN + 10, y + 1, { width: width - 10 });
    doc.x = MARGIN;
    muted(
      `${d.ecosystem} · ${d.direct ? "directa" : `transitiva: ${d.path.join(" › ")}${d.requiredBy ? ` (${d.requiredBy.name} pide "${d.requiredBy.range}")` : ""}`}${d.dev ? " · solo desarrollo" : ""} · ${d.sourceFile}`,
      8.5,
    );
    doc.moveDown(0.3);
    for (const v of f.vulnerabilities) {
      ensureSpace(30);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(SEV_COLOR[v.severity])
        .text(t(`${SEV_LABEL[v.severity]}${v.cvss !== undefined ? ` ${v.cvss.toFixed(1)}` : ""}  `), {
          continued: true,
        })
        .fillColor("#111827")
        .text(t(`${v.id} — ${v.summary}`), { width });
      muted(
        `${v.aliases.filter((a) => a !== v.id).join(", ")}${v.cwes?.length ? ` · ${v.cwes.join(", ")}` : ""} · ${v.fixedIn.length ? `corregida en ${v.fixedIn.join(", ")}` : "sin corrección"}`,
        8,
      );
    }

    const rm = f.remediation;
    if (!rm) return;
    doc.moveDown(0.3);
    ensureSpace(40);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(rm.status === "upgrade" ? "#15803d" : "#b45309");
    doc.text(
      t(
        rm.status === "upgrade"
          ? `Recomendación: actualizar a ${rm.recommended}`
          : rm.status === "no-fix"
            ? "Recomendación: no hay versión publicada libre de fallas conocidas"
            : "No se pudo calcular una versión segura",
      ),
      { width },
    );
    for (const o of rm.options) {
      body(
        `• ${OPTION_LABEL[o.kind]}: ${o.version}${o.version === rm.recommended ? " (recomendada)" : ""}${o.breaking ? " — cambio de versión mayor" : ""}`,
        9,
      );
    }
    if (rm.safeVersions.length) {
      muted(
        `Versiones seguras (${rm.totalSafeVersions}${rm.verified ? ", verificadas contra todos los avisos" : ", lista parcial"}): ${rm.safeVersions.slice(0, 25).join(", ")}${rm.totalSafeVersions > 25 ? "…" : ""}`,
        8.5,
      );
    }
    if (rm.commands.length) {
      doc.moveDown(0.2);
      body("Cómo aplicarlo:", 9);
      for (const c of rm.commands) {
        muted(c.label, 8.5);
        code(c.command);
      }
    }
    if (rm.snippet) {
      body(`Fragmento para ${rm.snippet.file}:`, 9);
      code(rm.snippet.content);
      muted(rm.snippet.note, 8);
    }
    if (rm.mitigations.length) {
      doc.moveDown(0.2);
      ensureSpace(30);
      body("Si vas a seguir usando la versión actual (medidas temporales):", 9);
      for (const m of rm.mitigations) {
        ensureSpace(24);
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor("#111827")
          .text(t(`• ${m.title} (${m.vulnId})`), { width });
        doc.font("Helvetica").fontSize(8.5).fillColor("#374151").text(t(m.text), { width, indent: 10 });
      }
    }
    if (rm.patches.length) {
      body("Parches de la corrección:", 9);
      for (const p of rm.patches) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#1d4ed8")
          .text(t(p.url), { width, link: p.url, underline: false });
      }
    }
    for (const n of rm.notes) muted(`Nota: ${n}`, 8);
    doc.moveDown(0.4);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + width, doc.y)
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .stroke();
  }

  heading("Limitaciones", 12);
  for (const l of [
    "Se reportan versiones con fallas conocidas; no se verifica si el código usa la función afectada.",
    "Solo se detecta lo publicado en OSV/NVD a la fecha del escaneo; las versiones seguras lo son respecto a los avisos conocidos hoy.",
    "Las mitigaciones son medidas temporales; la solución definitiva es actualizar.",
    "Sin lockfile la precisión baja (versiones estimadas o no determinables).",
  ]) {
    muted(`• ${l}`, 8.5);
  }

  // Pie de página con numeración.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Sin margen inferior temporalmente: si no, pdfkit agrega una página al escribir el pie.
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#9ca3af")
      .text(
        t(`depscan · ${r.target.name} · página ${i + 1} de ${range.count}`),
        MARGIN,
        doc.page.height - MARGIN + 14,
        {
          width,
          align: "center",
          lineBreak: false,
        },
      );
  }
  doc.end();
  return done;
}
