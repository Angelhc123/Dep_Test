import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as vscode from "vscode";
import { renderHtml, type Finding, type ScanReport, type Severity } from "@depscan/core";
import {
  aplicarVersion,
  corregible,
  esManifiesto,
  mensajeDiagnostico,
  superaSeveridad,
  ubicarDependencia,
} from "./manifiestos.js";
import type { Motor } from "./motor.js";

export interface Resultado {
  carpeta: vscode.WorkspaceFolder;
  reporte: ScanReport;
}

/** Hallazgo ubicado en un archivo concreto del workspace. */
export interface HallazgoUbicado {
  finding: Finding;
  uri: vscode.Uri;
  rango: vscode.Range | null;
}

const SEVERIDAD_DIAG: Record<Severity, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
  unknown: vscode.DiagnosticSeverity.Information,
};

export const osvUrl = (id: string) =>
  vscode.Uri.parse(`https://osv.dev/vulnerability/${encodeURIComponent(id)}`);

/**
 * Estado central de la extensión: escanea las carpetas del workspace con el
 * motor de DepScan y publica el resultado como diagnósticos, panel y barra.
 */
export class Controlador implements vscode.Disposable {
  readonly diagnosticos = vscode.languages.createDiagnosticCollection("depscan");
  private readonly barra = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  private readonly cambio = new vscode.EventEmitter<void>();
  /** Se dispara cada vez que termina un escaneo. */
  readonly onCambio = this.cambio.event;
  resultados: Resultado[] = [];
  hallazgos: HallazgoUbicado[] = [];
  private enCurso: Promise<Resultado[]> | null = null;
  private panel: vscode.WebviewPanel | undefined;

  constructor(readonly motor: Motor) {
    this.barra.command = "workbench.view.extension.depscan";
    this.barra.text = "$(shield) DepScan";
    this.barra.tooltip = "DepScan: escanear dependencias";
    this.barra.show();
  }

  dispose(): void {
    this.diagnosticos.dispose();
    this.barra.dispose();
    this.cambio.dispose();
    this.panel?.dispose();
  }

  private config() {
    const c = vscode.workspace.getConfiguration("depscan");
    return {
      includeDev: c.get<boolean>("includeDev", true),
      estimate: c.get<boolean>("estimate", true),
      minima: c.get<Severity>("minimumSeverity", "low"),
    };
  }

  /** Escanea todas las carpetas del workspace (si ya hay un escaneo en curso, lo reutiliza). */
  escanear(): Promise<Resultado[]> {
    this.enCurso ??= this.ejecutar().finally(() => (this.enCurso = null));
    return this.enCurso;
  }

  private async ejecutar(): Promise<Resultado[]> {
    const carpetas = vscode.workspace.workspaceFolders ?? [];
    const cfg = this.config();
    this.barra.text = "$(sync~spin) DepScan: escaneando…";
    this.barra.backgroundColor = undefined;
    try {
      const resultados: Resultado[] = [];
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: "DepScan: consultando OSV…" },
        async () => {
          for (const carpeta of carpetas) {
            const reporte = await this.motor.escanear(carpeta.uri.fsPath, carpeta.name, cfg);
            resultados.push({ carpeta, reporte });
          }
        },
      );
      this.resultados = resultados;
      await this.publicar(cfg.minima);
      return resultados;
    } catch (e) {
      this.barra.text = "$(error) DepScan: error";
      this.barra.tooltip = `No se pudo escanear: ${(e as Error).message}`;
      throw e;
    } finally {
      this.cambio.fire();
    }
  }

  private async publicar(minima: Severity): Promise<void> {
    this.diagnosticos.clear();
    this.hallazgos = [];
    const porArchivo = new Map<string, vscode.Diagnostic[]>();
    const textos = new Map<string, string>();

    for (const { carpeta, reporte } of this.resultados) {
      for (const finding of reporte.findings) {
        const { uri, u } = await ubicar(carpeta, finding, textos);
        const clave = uri.toString();
        const rango = u ? new vscode.Range(u.line, u.start, u.line, u.end) : null;
        this.hallazgos.push({ finding, uri, rango });
        if (!superaSeveridad(finding, minima)) continue;

        const d = new vscode.Diagnostic(
          rango ?? new vscode.Range(0, 0, 0, 1),
          mensajeDiagnostico(finding),
          SEVERIDAD_DIAG[finding.maxSeverity],
        );
        d.source = "DepScan";
        const primera = finding.vulnerabilities[0]!;
        d.code = { value: primera.id, target: osvUrl(primera.id) };
        porArchivo.set(clave, [...(porArchivo.get(clave) ?? []), d]);
      }
    }
    for (const [clave, diags] of porArchivo) this.diagnosticos.set(vscode.Uri.parse(clave), diags);

    const vulnerables = this.hallazgos.length;
    const total = this.resultados.reduce((n, r) => n + r.reporte.summary.dependencies, 0);
    const rojo = this.resultados.some((r) => r.reporte.summary.risk === "red");
    this.barra.text =
      vulnerables === 0
        ? "$(pass-filled) DepScan: sin vulnerables"
        : `$(shield) DepScan: ${vulnerables} vulnerables`;
    this.barra.tooltip = `${vulnerables} de ${total} dependencias con vulnerabilidades conocidas. Clic para ver el detalle.`;
    this.barra.backgroundColor =
      vulnerables === 0
        ? undefined
        : new vscode.ThemeColor(rojo ? "statusBarItem.errorBackground" : "statusBarItem.warningBackground");
    if (this.panel) this.panel.webview.html = this.htmlReporte();
  }

  /** Hallazgo cuyo rango contiene la posición (para hover y Quick Fix). */
  hallazgoEn(uri: vscode.Uri, pos: vscode.Position | vscode.Range): HallazgoUbicado | undefined {
    return this.hallazgos.find(
      (h) =>
        h.uri.toString() === uri.toString() &&
        h.rango &&
        h.rango.contains(pos instanceof vscode.Range ? pos.start : pos),
    );
  }

  buscarPaquete(nombre: string): HallazgoUbicado | undefined {
    const n = nombre.toLowerCase();
    return this.hallazgos.find((h) => h.finding.dependency.name.toLowerCase() === n);
  }

  /** Edición que actualiza una dependencia directa a su versión segura (o null si no aplica). */
  async edicionPara(h: HallazgoUbicado): Promise<vscode.WorkspaceEdit | null> {
    if (!corregible(h.finding)) return null;
    const doc = await vscode.workspace.openTextDocument(h.uri);
    const texto = doc.getText();
    const nuevo = aplicarVersion(
      h.uri.fsPath,
      texto,
      h.finding.dependency.name,
      h.finding.remediation!.recommended!,
    );
    if (!nuevo || nuevo === texto) return null;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(h.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(texto.length)), nuevo);
    return edit;
  }

  /** Aplica la versión segura a una dependencia y guarda el archivo. */
  async corregir(h: HallazgoUbicado): Promise<boolean> {
    const edit = await this.edicionPara(h);
    if (!edit) return false;
    const ok = await vscode.workspace.applyEdit(edit);
    if (ok) await (await vscode.workspace.openTextDocument(h.uri)).save();
    return ok;
  }

  async corregirTodas(): Promise<string[]> {
    const hechas: string[] = [];
    for (const h of this.hallazgos.filter((x) => corregible(x.finding))) {
      if (await this.corregir(h))
        hechas.push(`${h.finding.dependency.name} → ${h.finding.remediation!.recommended}`);
    }
    return hechas;
  }

  mostrarReporte(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      "depscan.reporte",
      "DepScan: reporte",
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
      },
    );
    this.panel.webview.html = this.htmlReporte();
    this.panel.onDidDispose(() => (this.panel = undefined));
  }

  private htmlReporte(): string {
    if (!this.resultados.length) {
      return `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">Aún no hay escaneos. Ejecuta “DepScan: Escanear dependencias del proyecto”.</body>`;
    }
    // Un reporte por carpeta del workspace, con el mismo HTML que la web y la CLI.
    return this.resultados.map((r) => renderHtml(r.reporte)).join("\n<hr>\n");
  }

  /** Abre el archivo y selecciona la dependencia. */
  async abrir(h: HallazgoUbicado): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(h.uri);
    const editor = await vscode.window.showTextDocument(doc);
    if (h.rango) {
      editor.selection = new vscode.Selection(h.rango.start, h.rango.end);
      editor.revealRange(h.rango, vscode.TextEditorRevealType.InCenter);
    }
  }

  esManifiesto(doc: vscode.TextDocument): boolean {
    return doc.uri.scheme === "file" && esManifiesto(doc.uri.fsPath);
  }
}

/**
 * Archivo y posición donde se marca un hallazgo. Con lockfile el motor atribuye
 * todas las dependencias a package-lock.json; las DIRECTAS se marcan en el
 * package.json vecino, que es lo que el desarrollador edita (y donde aplica el Quick Fix).
 */
async function ubicar(carpeta: vscode.WorkspaceFolder, f: Finding, textos: Map<string, string>) {
  const rel = f.dependency.sourceFile;
  const candidatos = [rel];
  if (f.dependency.direct && /(^|\/)(package-lock|npm-shrinkwrap)\.json$/.test(rel)) {
    candidatos.unshift(rel.replace(/(package-lock|npm-shrinkwrap)\.json$/, "package.json"));
  }
  for (const c of candidatos) {
    const uri = vscode.Uri.file(join(carpeta.uri.fsPath, c));
    const clave = uri.toString();
    if (!textos.has(clave)) textos.set(clave, await leerTexto(uri));
    const u = ubicarDependencia(uri.fsPath, textos.get(clave)!, f.dependency.name);
    if (u) return { uri, u };
  }
  return { uri: vscode.Uri.file(join(carpeta.uri.fsPath, rel)), u: null };
}

async function leerTexto(uri: vscode.Uri): Promise<string> {
  const abierto = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (abierto) return abierto.getText();
  try {
    return await readFile(uri.fsPath, "utf8");
  } catch {
    return "";
  }
}
