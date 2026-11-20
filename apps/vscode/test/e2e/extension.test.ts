// PRUEBAS E2E de la extensión: se ejecutan dentro de un VS Code real
// (@vscode/test-electron) con el proyecto test/e2e/proyecto abierto.
// OSV y los registros se simulan para que el resultado sea reproducible.
import * as assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import * as vscode from "vscode";
import type { OsvVulnerability, ScanSources } from "@depscan/core";
import { isAffected } from "@depscan/core";
import type { DepScanApi } from "../../src/extension.js";

const VULNS: OsvVulnerability[] = [
  {
    id: "GHSA-e2e-lodash",
    aliases: ["CVE-2021-23337"],
    summary: "Inyección de comandos en lodash.template",
    database_specific: { severity: "HIGH", cwe_ids: ["CWE-77"] },
    affected: [
      {
        package: { name: "lodash", ecosystem: "npm" },
        ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }],
      },
    ],
  },
  {
    id: "GHSA-e2e-django",
    aliases: ["CVE-2023-31047"],
    summary: "Validación incompleta de archivos subidos",
    database_specific: { severity: "CRITICAL" },
    affected: [
      {
        package: { name: "django", ecosystem: "PyPI" },
        ranges: [{ type: "ECOSYSTEM", events: [{ introduced: "0" }, { fixed: "3.2.19" }] }],
      },
    ],
  },
];
const VERSIONES: Record<string, string[]> = {
  "npm:lodash": ["4.17.15", "4.17.20", "4.17.21"],
  "npm:express": ["4.18.2"],
  "PyPI:django": ["3.2.0", "3.2.19"],
  "PyPI:requests": ["2.31.0"],
};
const delPaquete = (eco: string, n: string) =>
  VULNS.filter((v) =>
    v.affected!.some((a) => a.package!.ecosystem === eco && a.package!.name === n.toLowerCase()),
  );

const fuentes: ScanSources = {
  osv: {
    queryBatch: async (qs) =>
      qs.map((q) =>
        delPaquete(q.ecosystem, q.name)
          .filter((v) => isAffected(q.version, v.affected!, q.ecosystem))
          .map((v) => v.id),
      ),
    getVulnerability: async (id) => VULNS.find((v) => v.id === id) ?? null,
    queryPackage: async (n, eco) => delPaquete(eco, n),
  },
  registry: { listVersions: async (eco, n) => VERSIONES[`${eco}:${n.toLowerCase()}`] ?? null },
};

const raiz = vscode.workspace.workspaceFolders![0]!.uri;
const pkgUri = vscode.Uri.joinPath(raiz, "package.json");
const reqUri = vscode.Uri.joinPath(raiz, "requirements.txt");
const lockUri = vscode.Uri.joinPath(raiz, "package-lock.json");
const ORIGINAL_PKG = readFileSync(pkgUri.fsPath, "utf8");
const ORIGINAL_LOCK = readFileSync(lockUri.fsPath, "utf8");
const ORIGINAL_REQ = readFileSync(reqUri.fsPath, "utf8");

let api: DepScanApi;

const esperar = async (cond: () => boolean, ms = 10000) => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error("tiempo de espera agotado");
    await new Promise((r) => setTimeout(r, 100));
  }
};

describe("Extensión DepScan (VS Code real)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension<DepScanApi>("depscan-upt.depscan-vscode")!;
    api = await ext.activate();
    api.usarFuentes(fuentes);
    await vscode.commands.executeCommand("depscan.scanWorkspace");
  });

  after(() => {
    writeFileSync(pkgUri.fsPath, ORIGINAL_PKG);
    writeFileSync(reqUri.fsPath, ORIGINAL_REQ);
    writeFileSync(lockUri.fsPath, ORIGINAL_LOCK);
  });

  it("subraya lodash (directa, versión del lockfile) en package.json con el CVE y la versión segura", () => {
    const diags = vscode.languages.getDiagnostics(pkgUri);
    assert.equal(diags.length, 1);
    const d = diags[0]!;
    assert.equal(d.source, "DepScan");
    assert.equal(d.severity, vscode.DiagnosticSeverity.Error);
    assert.match(
      d.message,
      /lodash 4\.17\.15: 1 vulnerabilidad HIGH \(CVE-2021-23337\) → actualizar a 4\.17\.21/,
    );
    assert.equal(d.range.start.line, 5);
  });

  it("subraya django en requirements.txt como crítica y no marca requests", () => {
    const diags = vscode.languages.getDiagnostics(reqUri);
    assert.equal(diags.length, 1);
    assert.match(diags[0]!.message, /^django 3\.2\.0: .*CRITICAL/);
    assert.equal(diags[0]!.range.start.line, 0);
  });

  it("el hover muestra el detalle y la solución verificada", async () => {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      pkgUri,
      new vscode.Position(5, 8),
    );
    const texto = hovers
      .flatMap((h) => h.contents)
      .map((c) => (c instanceof vscode.MarkdownString ? c.value : String(c)))
      .join("\n");
    assert.match(texto, /DepScan: `lodash@4\.17\.15`/);
    assert.match(texto, /actualizar a `4\.17\.21`/);
    assert.match(texto, /verificada/);
  });

  it("el Quick Fix actualiza lodash a ^4.17.21 y el reescaneo limpia el subrayado", async () => {
    const doc = await vscode.workspace.openTextDocument(pkgUri);
    await vscode.window.showTextDocument(doc);
    const acciones = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      "vscode.executeCodeActionProvider",
      pkgUri,
      new vscode.Range(5, 6, 5, 10),
    );
    const fix = acciones.find((a) => a.title.startsWith("DepScan: actualizar lodash a 4.17.21"));
    assert.ok(fix, `acciones: ${acciones.map((a) => a.title).join(" | ")}`);
    assert.equal(fix.isPreferred, true);
    await vscode.workspace.applyEdit(fix.edit!);
    assert.match(doc.getText(), /"lodash": "\^4\.17\.21"/);
    // Equivale a "npm install": el lockfile pasa a la versión segura. Guardar dispara el reescaneo.
    writeFileSync(lockUri.fsPath, ORIGINAL_LOCK.replace('"version": "4.17.15"', '"version": "4.17.21"'));
    await doc.save();
    await esperar(() => vscode.languages.getDiagnostics(pkgUri).length === 0);
  });

  it("la skill depscan_scan devuelve el resultado para la IA", async () => {
    const tool = vscode.lm.tools.find((t) => t.name === "depscan_scan");
    assert.ok(tool, "la skill está registrada");
    const res = await vscode.lm.invokeTool("depscan_scan", { input: {}, toolInvocationToken: undefined });
    const json = JSON.parse((res.content[0] as vscode.LanguageModelTextPart).value);
    assert.equal(json.hallazgos[0].paquete, "django");
    assert.equal(json.hallazgos[0].versionSegura, "3.2.19");
    assert.equal(json.hallazgos[0].corregibleAutomaticamente, true);
  });

  it("la skill depscan_vulnerability explica un CVE por su alias", async () => {
    const res = await vscode.lm.invokeTool("depscan_vulnerability", {
      input: { id: "CVE-2023-31047" },
      toolInvocationToken: undefined,
    });
    const json = JSON.parse((res.content[0] as vscode.LanguageModelTextPart).value);
    assert.equal(json.afectaA, "django@3.2.0");
    assert.deepEqual(json.corregidaEn, ["3.2.19"]);
  });

  it("'Actualizar todas' corrige requirements.txt y deja el proyecto sin vulnerables", async () => {
    await vscode.commands.executeCommand("depscan.fixAllDirect");
    assert.match(readFileSync(reqUri.fsPath, "utf8"), /^django==3\.2\.19$/m);
    await api.escanear();
    assert.equal(api.controlador.hallazgos.length, 0);
    assert.equal(api.controlador.resultados[0]!.reporte.summary.risk, "green");
  });

  it("registra el agente @depscan y sus comandos", () => {
    const pkg = vscode.extensions.getExtension("depscan-upt.depscan-vscode")!.packageJSON;
    const agente = pkg.contributes.chatParticipants[0];
    assert.equal(agente.name, "depscan");
    assert.deepEqual(
      agente.commands.map((c: { name: string }) => c.name),
      ["scan", "fix", "explain"],
    );
  });
});
