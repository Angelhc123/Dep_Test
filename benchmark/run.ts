/**
 * Benchmark reproducible: depscan vs npm audit vs osv-scanner sobre repos fijados en un commit.
 *
 *   npm run build && npm run benchmark
 *
 * - Descarga los manifiestos de cada repo en su commit exacto (benchmark/repos.json).
 * - Ejecuta depscan (motor propio), `npm audit --package-lock-only` (repos npm) y
 *   `osv-scanner` (si está instalado en el PATH).
 * - Cruza hallazgos por (paquete, ID de aviso) usando los alias (CVE/GHSA/PYSEC).
 * - Guarda resultados en benchmark/results/AAAA-MM-DD/ con fecha y versiones de herramientas.
 *
 * Se ejecuta con el soporte nativo de TypeScript de Node 24 (sin compilar).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchGithubProject,
  MemoryCache,
  normalizePyName,
  OsvClient,
  scanProject,
  SCANNER_VERSION,
  type ScanReport,
} from "@depscan/core";

interface RepoEntry {
  repo: string;
  commit: string;
  ecosystem: "npm" | "PyPI";
}

/** Un hallazgo de cualquier herramienta: paquete + todos los IDs con que se conoce la falla. */
interface Hit {
  pkg: string;
  ids: string[];
}

interface ToolResult {
  available: boolean;
  version?: string;
  hits: Hit[];
  error?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const date = new Date().toISOString().slice(0, 10);
const outDir = join(here, "results", date);
const isWin = process.platform === "win32";

function run(cmd: string, args: string[], cwd?: string) {
  // npm en Windows es un .cmd: se invoca su CLI JS con el propio Node para no usar shell.
  if (cmd === "npm" && process.env.npm_execpath) {
    return spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  }
  return spawnSync(isWin && cmd === "npm" ? "npm.cmd" : cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

function toolVersion(cmd: string, args: string[]): string | undefined {
  const r = run(cmd, args);
  return r.status === 0 ? r.stdout.trim().split("\n")[0] : undefined;
}

const normPkg = (eco: string, name: string) => (eco === "PyPI" ? normalizePyName(name) : name);

function depscanHits(r: ScanReport): Hit[] {
  return r.findings.flatMap((f) =>
    f.vulnerabilities.map((v) => ({
      pkg: normPkg(f.dependency.ecosystem, f.dependency.name),
      ids: v.aliases,
    })),
  );
}

interface NpmAuditJson {
  vulnerabilities?: Record<string, { via: (string | { url?: string; source?: number })[] }>;
}

function npmAudit(dir: string): ToolResult {
  const version = toolVersion("npm", ["--version"]);
  const r = run("npm", ["audit", "--json", "--package-lock-only"], dir);
  try {
    const json = JSON.parse(r.stdout) as NpmAuditJson;
    const hits: Hit[] = [];
    for (const [name, v] of Object.entries(json.vulnerabilities ?? {})) {
      for (const via of v.via) {
        // "via" como string = depende de otro paquete vulnerable (no es un aviso propio).
        if (typeof via === "string" || !via.url) continue;
        const ghsa = via.url.split("/").pop()!;
        hits.push({ pkg: name, ids: [ghsa] });
      }
    }
    return { available: true, version: `npm ${version}`, hits };
  } catch {
    return { available: true, version, hits: [], error: r.stderr.slice(0, 500) || "salida no válida" };
  }
}

interface OsvScannerJson {
  results?: {
    packages?: {
      package: { name: string; ecosystem: string };
      vulnerabilities?: { id: string; aliases?: string[] }[];
    }[];
  }[];
}

function osvScanner(dir: string, manifests: string[]): ToolResult {
  const version = toolVersion("osv-scanner", ["--version"]);
  if (!version) return { available: false, hits: [] };
  const lockfiles = manifests.filter((m) => /package-lock\.json$|requirements[^/]*\.txt$/.test(m));
  const args = ["scan", "source", "--format=json", ...lockfiles.flatMap((m) => ["-L", join(dir, m)])];
  const r = run("osv-scanner", args);
  try {
    const json = JSON.parse(r.stdout) as OsvScannerJson;
    const hits = (json.results ?? []).flatMap((res) =>
      (res.packages ?? []).flatMap((p) =>
        (p.vulnerabilities ?? []).map((v) => ({
          pkg: normPkg(p.package.ecosystem, p.package.name),
          ids: [v.id, ...(v.aliases ?? [])],
        })),
      ),
    );
    return { available: true, version, hits };
  } catch {
    return { available: true, version, hits: [], error: r.stderr.slice(0, 500) || "salida no válida" };
  }
}

/** Un mismo aviso en varias versiones del mismo paquete cuenta una vez. */
function uniqueHits(hits: Hit[]): Hit[] {
  return hits.filter(
    (h, i) => hits.findIndex((x) => x.pkg === h.pkg && x.ids.some((id) => h.ids.includes(id))) === i,
  );
}

/** Compara dos listas de hallazgos: coinciden si es el mismo paquete y comparten algún ID. */
function compare(ours: Hit[], theirs: Hit[]) {
  const matches = (a: Hit, b: Hit) => a.pkg === b.pkg && a.ids.some((id) => b.ids.includes(id));
  const o = uniqueHits(ours);
  const t = uniqueHits(theirs);
  return {
    ours: o.length,
    theirs: t.length,
    common: o.filter((h) => t.some((x) => matches(h, x))).length,
    onlyOurs: o.filter((h) => !t.some((x) => matches(h, x))),
    onlyTheirs: t.filter((h) => !o.some((x) => matches(h, x))),
  };
}

async function main() {
  const { repos } = JSON.parse(readFileSync(join(here, "repos.json"), "utf8")) as { repos: RepoEntry[] };
  mkdirSync(outDir, { recursive: true });
  const cache = new MemoryCache();
  const rows: string[] = [];
  const review: string[] = [];
  const npmVersion = toolVersion("npm", ["--version"]);
  const osvVersion = toolVersion("osv-scanner", ["--version"]);

  for (const entry of repos) {
    const [owner, repo] = entry.repo.split("/") as [string, string];
    process.stderr.write(`→ ${entry.repo}@${entry.commit.slice(0, 8)}\n`);
    const gh = await fetchGithubProject(
      { owner, repo, ref: entry.commit },
      { token: process.env.GITHUB_TOKEN },
    );
    const report = await scanProject(
      gh.files,
      { osv: new OsvClient({ cache }) },
      {
        target: { name: entry.repo, source: "github", commit: gh.commit },
      },
    );

    // Los manifiestos se escriben en una carpeta temporal para las herramientas externas.
    const dir = mkdtempSync(join(tmpdir(), "depscan-bench-"));
    for (const [path, content] of gh.files) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    const ours = depscanHits(report);
    const audit: ToolResult = gh.files.has("package-lock.json")
      ? npmAudit(dir)
      : { available: false, hits: [] };
    const osv = osvScanner(dir, [...gh.files.keys()]);
    rmSync(dir, { recursive: true, force: true });

    const vsAudit = audit.available ? compare(ours, audit.hits) : null;
    const vsOsv = osv.available ? compare(ours, osv.hits) : null;
    writeFileSync(
      join(outDir, `${entry.repo.replace("/", "__")}.json`),
      JSON.stringify(
        { entry, scannedAt: report.scannedAt, report, npmAudit: audit, osvScanner: osv, vsAudit, vsOsv },
        null,
        2,
      ),
    );

    const s = report.summary;
    const fmt = (c: ReturnType<typeof compare> | null) =>
      c ? `${c.theirs} | ${c.common} | ${c.onlyOurs.length} | ${c.onlyTheirs.length}` : "— | — | — | —";
    rows.push(
      `| ${entry.repo} | \`${entry.commit.slice(0, 8)}\` | ${s.dependencies} | ${s.unresolved} | ${uniqueHits(ours).length} | ${fmt(vsAudit)} | ${fmt(vsOsv)} |`,
    );
    for (const [tool, c] of [
      ["npm audit", vsAudit],
      ["osv-scanner", vsOsv],
    ] as const) {
      if (!c) continue;
      for (const h of c.onlyOurs.slice(0, 5))
        review.push(`| ${entry.repo} | ${h.pkg} | ${h.ids.join(", ")} | solo depscan (vs ${tool}) | |`);
      for (const h of c.onlyTheirs.slice(0, 5))
        review.push(`| ${entry.repo} | ${h.pkg} | ${h.ids.join(", ")} | solo ${tool} | |`);
    }
  }

  const md = `# Benchmark ${date}

- depscan ${SCANNER_VERSION} · ${npmVersion ? `npm ${npmVersion}` : "npm no disponible"} · ${osvVersion ?? "osv-scanner no instalado"}
- Fecha del escaneo: ${new Date().toISOString()} (las bases OSV/NVD cambian a diario)
- Unidad de comparación: (paquete, aviso). Dos hallazgos coinciden si es el mismo paquete y comparten algún ID o alias.

| Repo | Commit | Deps | Sin versión | depscan | npm audit | común | solo depscan | solo audit | osv-scanner | común | solo depscan | solo osv |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}

## Muestra para revisión manual

Leer el aviso original y clasificar cada diferencia como *acierto*, *falso positivo* o *diferencia de criterio*
(por ejemplo, npm audit agrupa por nombre de paquete sin versión, y sin lockfile depscan no verifica rangos).

| Repo | Paquete | IDs | Diferencia | Clasificación (manual) |
|---|---|---|---|---|
${review.join("\n") || "| — | — | — | Sin diferencias | |"}
`;
  writeFileSync(join(outDir, "RESUMEN.md"), md);
  process.stderr.write(`\nResultados en ${outDir}\n`);
  console.log(md);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
