// Gráficos estadísticos de la presentación de calidad, generados a partir de datos reales:
//   datos/telemetria-demo.json  ← scripts/telemetria-demo.mjs (carga simulada sobre DepScan real)
//   datos/resumen-ci.json        ← https://angelhc123.github.io/Dep_Test/resumen.json (último CI)
// Salida: diagramas/graf-*.svg (build.js los incrusta con {{SVG:graf-…}}).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const leer = (f) => JSON.parse(readFileSync(join(DIR, "datos", f), "utf8"));
const tel = leer("telemetria-demo.json");
const ci = leer("resumen-ci.json");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const txt = (x, y, s, est = "", anchor = "start") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:12px;fill:var(--muted);${est}">${esc(s)}</text>`;
const guardar = (n, w, h, label, cuerpo) =>
  writeFileSync(
    join(DIR, "diagramas", `${n}.svg`),
    `<svg class="dg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${cuerpo}</svg>`,
  );
const nice = (v) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
};
const hora = (iso) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" });

// 1 · Peticiones por minuto (barras) + latencia p95 (línea, eje derecho)
{
  const s = tel.final.series;
  const W = 560, H = 300, L = 46, R = 50, T = 18, B = 40;
  const iw = W - L - R, ih = H - T - B;
  const maxR = nice(Math.max(...s.map((p) => p.requests)));
  const maxL = nice(Math.max(...s.map((p) => p.p95Ms)) * 1.2);
  const bw = (iw / s.length) * 0.62;
  const x = (i) => L + (iw / s.length) * (i + 0.5);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const y = T + ih - (ih * k) / 4;
    g += `<path d="M${L},${y} H${W - R}" style="stroke:var(--line);stroke-width:1"/>`;
    g += txt(L - 8, y + 4, Math.round((maxR * k) / 4), "", "end");
    g += txt(W - R + 8, y + 4, `${((maxL * k) / 4).toFixed(1)} ms`);
  }
  s.forEach((p, i) => {
    const h = (ih * p.requests) / maxR;
    g += `<rect x="${x(i) - bw / 2}" y="${T + ih - h}" width="${bw}" height="${h}" rx="3" style="fill:var(--accent)"/>`;
    g += `<text x="${x(i)}" y="${T + ih - h - 6}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--ink)">${p.requests}</text>`;
    g += txt(x(i), H - 18, hora(p.t), "", "middle");
  });
  const pts = s.map((p, i) => `${x(i)},${T + ih - (ih * p.p95Ms) / maxL}`).join(" ");
  g += `<polyline points="${pts}" style="fill:none;stroke:var(--amber);stroke-width:2.5"/>`;
  s.forEach((p, i) => (g += `<circle cx="${x(i)}" cy="${T + ih - (ih * p.p95Ms) / maxL}" r="4" style="fill:var(--amber);stroke:var(--slide);stroke-width:2"/>`));
  g += `<rect x="${L}" y="${H - 10}" width="10" height="10" rx="2" style="fill:var(--accent)"/>` + txt(L + 14, H - 1, "peticiones por minuto (eje izq.)");
  g += `<path d="M${L + 230},${H - 5} h16" style="stroke:var(--amber);stroke-width:2.5"/>` + txt(L + 252, H - 1, "latencia p95 en ms (eje der.)");
  guardar("graf-peticiones", W, H, "Peticiones por minuto y latencia p95", g);
}

// 2 · Escaneos por minuto
{
  const s = tel.final.series;
  const W = 420, H = 300, L = 40, R = 12, T = 18, B = 40;
  const iw = W - L - R, ih = H - T - B;
  const max = nice(Math.max(...s.map((p) => p.scans)));
  const bw = (iw / s.length) * 0.62;
  const x = (i) => L + (iw / s.length) * (i + 0.5);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const y = T + ih - (ih * k) / 4;
    g += `<path d="M${L},${y} H${W - R}" style="stroke:var(--line);stroke-width:1"/>` + txt(L - 8, y + 4, Math.round((max * k) / 4), "", "end");
  }
  s.forEach((p, i) => {
    const h = (ih * p.scans) / max;
    g += `<rect x="${x(i) - bw / 2}" y="${T + ih - h}" width="${bw}" height="${h}" rx="3" style="fill:var(--green)"/>`;
    g += `<text x="${x(i)}" y="${T + ih - h - 6}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--ink)">${p.scans}</text>`;
    g += txt(x(i), H - 18, hora(p.t), "", "middle");
  });
  g += txt(L, H - 1, "escaneos completados por minuto");
  guardar("graf-escaneos", W, H, "Escaneos por minuto", g);
}

// 3 · Acumulado (muestras cada 10 s): peticiones y escaneos
{
  const m = tel.muestras;
  const W = 560, H = 200, L = 46, R = 16, T = 14, B = 38;
  const iw = W - L - R, ih = H - T - B;
  const max = nice(Math.max(...m.map((p) => p.requests)));
  const x = (i) => L + (iw * i) / (m.length - 1);
  const y = (v) => T + ih - (ih * v) / max;
  let g = "";
  for (let k = 0; k <= 4; k++) {
    g += `<path d="M${L},${y((max * k) / 4)} H${W - R}" style="stroke:var(--line);stroke-width:1"/>` + txt(L - 8, y((max * k) / 4) + 4, Math.round((max * k) / 4), "", "end");
  }
  const linea = (campo, color) =>
    `<polyline points="${m.map((p, i) => `${x(i)},${y(p[campo])}`).join(" ")}" style="fill:none;stroke:${color};stroke-width:2.5"/>`;
  g += linea("requests", "var(--accent)") + linea("historial", "var(--amber)") + linea("scans", "var(--green)").replace("stroke-width:2.5", "stroke-width:2.5;stroke-dasharray:6 5");
  const u = m.at(-1);
  g += `<text x="${x(m.length - 1) - 4}" y="${y(u.requests) - 8}" text-anchor="end" style="font-size:12px;font-weight:700;fill:var(--accent)">${u.requests} peticiones</text>`;
  g += `<text x="${x(m.length - 1) - 4}" y="${y(u.scans) + 18}" text-anchor="end" style="font-size:12px;font-weight:700;fill:var(--green)">${u.scans} escaneos = ${u.historial} en historial</text>`;
  [0, Math.floor(m.length / 2), m.length - 1].forEach((i) => (g += txt(x(i), H - 18, hora(m[i].t), "", "middle")));
  g += txt(L, H - 1, `muestras de GET /api/metrics cada 10 s (${m.length} muestras)`);
  guardar("graf-acumulado", W, H, "Peticiones y escaneos acumulados", g);
}

// 4 · Respuestas por clase y escaneos por semáforo (barras horizontales)
{
  const f = tel.final;
  const filas = [
    ["2xx correctas", f.http.byStatus["2xx"] ?? 0, "var(--green)"],
    ["4xx rechazadas (a propósito)", f.http.byStatus["4xx"] ?? 0, "var(--amber)"],
    ["5xx errores del servidor", f.http.byStatus["5xx"] ?? 0, "var(--red)"],
    ["escaneos en rojo", f.scans.byRisk.red ?? 0, "var(--red)"],
    ["escaneos en verde", f.scans.byRisk.green ?? 0, "var(--green)"],
  ];
  const W = 560, H = 196, L = 220, R = 60;
  const max = Math.max(...filas.map((r) => r[1]));
  let g = "";
  filas.forEach(([n, v, c], i) => {
    const y = 4 + i * 36 + (i >= 3 ? 10 : 0);
    const w = ((W - L - R) * v) / max;
    g += txt(L - 10, y + 17, n, "fill:var(--ink)", "end");
    g += `<rect x="${L}" y="${y + 2}" width="${Math.max(w, 2)}" height="22" rx="3" style="fill:${c}"/>`;
    g += `<text x="${L + Math.max(w, 2) + 6}" y="${y + 18}" style="font-size:13px;font-weight:700;fill:var(--ink)">${v}</text>`;
  });
  g += `<path d="M10,114 H${W - 10}" style="stroke:var(--line);stroke-dasharray:4 4"/>`;
  guardar("graf-estados", W, H, "Respuestas por clase y escaneos por semáforo", g);
}

// 5 · Pruebas automatizadas por tipo (último CI)
{
  const filas = ci.suites.filter((s) => s.total);
  const W = 560, H = 36 + filas.length * 40, L = 200, R = 70;
  const max = Math.max(...filas.map((s) => s.total));
  let g = "";
  filas.forEach((s, i) => {
    const y = 8 + i * 40;
    const ok = s.total - s.fallidas - s.omitidas;
    const w = ((W - L - R) * s.total) / max;
    g += txt(L - 10, y + 20, s.nombre, "fill:var(--ink);font-size:13px", "end");
    g += `<rect x="${L}" y="${y + 4}" width="${Math.max(w, 3)}" height="24" rx="3" style="fill:${s.fallidas ? "var(--red)" : "var(--accent)"}"/>`;
    g += `<text x="${L + Math.max(w, 3) + 8}" y="${y + 21}" style="font-size:13px;font-weight:700;fill:var(--ink)">${ok}/${s.total}</text>`;
  });
  g += txt(L, H - 4, `fuente: resumen.json del panel (commit ${String(ci.commit ?? "").slice(0, 7)})`);
  guardar("graf-pruebas", W, H, "Pruebas automatizadas por tipo", g);
}

console.log("gráficos generados");
