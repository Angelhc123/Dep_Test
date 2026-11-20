// Punto de entrada de la extensión DepScan para VS Code.
import * as vscode from "vscode";
import type { ScanSources } from "@depscan/core";
import { registrarAgente, registrarSkills } from "./agente.js";
import { Controlador, type HallazgoUbicado } from "./controlador.js";
import { CacheArchivo, Motor } from "./motor.js";
import { registrarProveedores } from "./proveedores.js";

/** API pública de la extensión (la usan las pruebas e2e). */
export interface DepScanApi {
  usarFuentes(fuentes: ScanSources): void;
  escanear(): Promise<void>;
  controlador: Controlador;
}

export function activate(ctx: vscode.ExtensionContext): DepScanApi {
  const cache = new CacheArchivo(ctx.globalStorageUri.fsPath);
  const motor = new Motor(cache);
  const ctl = new Controlador(motor);
  ctx.subscriptions.push(ctl, { dispose: () => cache.guardar() });

  const escanearConAviso = async () => {
    try {
      await ctl.escanear();
    } catch (e) {
      void vscode.window.showErrorMessage(`DepScan no pudo escanear: ${(e as Error).message}`);
    }
  };

  ctx.subscriptions.push(
    ...registrarProveedores(ctl),
    ...registrarSkills(ctl),
    registrarAgente(ctl, ctx),

    vscode.commands.registerCommand("depscan.scanWorkspace", escanearConAviso),
    vscode.commands.registerCommand("depscan.showReport", () => ctl.mostrarReporte()),
    vscode.commands.registerCommand("depscan.openFinding", (h: HallazgoUbicado) => ctl.abrir(h)),
    vscode.commands.registerCommand("depscan.fixOne", async (nombre: string) => {
      const h = ctl.buscarPaquete(nombre);
      if (h && (await ctl.corregir(h))) {
        void vscode.window.showInformationMessage(
          `DepScan: ${nombre} actualizado a ${h.finding.remediation!.recommended}. Ejecuta npm install / pip install.`,
        );
      }
    }),
    vscode.commands.registerCommand("depscan.fixAllDirect", async () => {
      if (!ctl.resultados.length) await ctl.escanear();
      const hechas = await ctl.corregirTodas();
      void vscode.window.showInformationMessage(
        hechas.length
          ? `DepScan actualizó ${hechas.length}: ${hechas.join(", ")}. Ejecuta npm install / pip install para aplicar.`
          : "DepScan: no hay dependencias directas que se puedan actualizar automáticamente.",
      );
    }),
    vscode.commands.registerCommand("depscan.clearCache", () => {
      cache.limpiar();
      void vscode.window.showInformationMessage("DepScan: caché de vulnerabilidades vaciada.");
    }),

    // Reescanear al guardar un manifiesto (configurable).
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (ctl.esManifiesto(doc) && vscode.workspace.getConfiguration("depscan").get("scanOnSave", true)) {
        void escanearConAviso();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void escanearConAviso()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("depscan")) void escanearConAviso();
    }),
  );

  // Primer escaneo al activar (salvo en pruebas, que inyectan fuentes simuladas antes).
  if (ctx.extensionMode !== vscode.ExtensionMode.Test) void escanearConAviso();

  return {
    usarFuentes: (f) => motor.usarFuentes(f),
    escanear: () => ctl.escanear().then(() => undefined),
    controlador: ctl,
  };
}

export function deactivate(): void {}
