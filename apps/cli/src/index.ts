#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  fetchGithubProject,
  MemoryCache,
  NvdClient,
  OsvClient,
  parseGithubRepo,
  readProjectDirectory,
  RegistryClient,
  renderHtml,
  renderText,
  scanProject,
  SCANNER_VERSION,
  shouldFail,
  type FailThreshold,
  type ProjectFiles,
  type ScanTarget,
} from "@depscan/core";

const HELP = `depscan ${SCANNER_VERSION} — escáner de dependencias vulnerables (npm y PyPI)

Uso:
  depscan [carpeta]                 Escanea una carpeta local (por defecto la actual)
  depscan --github owner/repo[@ref] Escanea un repositorio público de GitHub

Opciones:
  -f, --format <table|json|html>    Formato de salida (por defecto: table)
  -o, --output <archivo>            Escribe el reporte en un archivo
      --fail-on <nivel>             critical | high | medium | low | none (por defecto: critical)
      --estimate                    Sin lockfile, estima versiones con el registro npm/PyPI
      --nvd                         Enriquece con NVD (usa NVD_API_KEY si existe)
      --no-dev                      Ignora devDependencies
      --no-remediation              No calcula versiones seguras ni mitigaciones (más rápido)
      --no-color                    Salida sin colores
  -h, --help                        Muestra esta ayuda

Códigos de salida: 0 sin hallazgos sobre el umbral · 1 hallazgos sobre el umbral · 2 error`;

const THRESHOLDS: FailThreshold[] = ["critical", "high", "medium", "low", "none"];

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      format: { type: "string", short: "f", default: "table" },
      output: { type: "string", short: "o" },
      "fail-on": { type: "string", default: "critical" },
      github: { type: "string" },
      estimate: { type: "boolean", default: false },
      nvd: { type: "boolean", default: false },
      "no-dev": { type: "boolean", default: false },
      "no-remediation": { type: "boolean", default: false },
      "no-color": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const format = values.format!;
  if (!["table", "json", "html"].includes(format)) throw new Error(`Formato no válido: ${format}`);
  const failOn = values["fail-on"] as FailThreshold;
  if (!THRESHOLDS.includes(failOn)) throw new Error(`--fail-on no válido: ${failOn}`);

  const log = (msg: string) => process.stderr.write(`${msg}\n`);
  let files: ProjectFiles;
  let target: ScanTarget;
  if (values.github) {
    const ref = parseGithubRepo(values.github);
    if (!ref) throw new Error(`Repositorio no válido: ${values.github} (usa owner/repo o la URL de GitHub)`);
    log(`Descargando manifiestos de ${ref.owner}/${ref.repo}…`);
    const gh = await fetchGithubProject(ref, { token: process.env.GITHUB_TOKEN });
    files = gh.files;
    target = { name: `${ref.owner}/${ref.repo}`, source: "github", commit: gh.commit, ref: gh.ref };
  } else {
    const dir = resolve(positionals[0] ?? ".");
    files = await readProjectDirectory(dir);
    target = { name: basename(dir), source: "directory" };
  }
  log(`Manifiestos encontrados: ${files.size}`);

  const cache = new MemoryCache();
  const report = await scanProject(
    files,
    {
      osv: new OsvClient({ cache }),
      nvd: values.nvd ? new NvdClient({ apiKey: process.env.NVD_API_KEY, cache }) : undefined,
      registry: values.estimate || !values["no-remediation"] ? new RegistryClient({ cache }) : undefined,
    },
    {
      target,
      estimate: values.estimate,
      enrichNvd: values.nvd,
      includeDev: !values["no-dev"],
      remediation: !values["no-remediation"],
      onProgress: (stage) => log(`· ${stage}`),
    },
  );

  const color = !values["no-color"] && !values.output && process.stdout.isTTY;
  const out =
    format === "json"
      ? JSON.stringify(report, null, 2)
      : format === "html"
        ? renderHtml(report)
        : renderText(report, color);
  if (values.output) {
    await writeFile(values.output, out, "utf8");
    log(`Reporte escrito en ${values.output}`);
    if (format !== "table") log(renderText(report, false).split("\n").slice(0, 4).join("\n"));
  } else {
    console.log(out);
  }
  return shouldFail(report.summary, failOn) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  },
);
