// Captura pantallas reales de la extensión DepScan dentro de VS Code (para la presentación).
// Abre el VS Code de pruebas (apps/vscode/.vscode-test) con la extensión en modo desarrollo
// sobre una copia de tests/fixtures/proyecto-demo y consulta OSV de verdad.
//
//   npm run build -w depscan-vscode && node scripts/capturas-vscode.mjs
import { cpSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";

const raiz = resolve(".");
const base = join(raiz, "apps/vscode/.vscode-test");
const carpeta = readdirSync(base).find((d) => d.startsWith("vscode-"));
const exe = join(base, carpeta, "Code.exe");
const salida = join(raiz, "docs/presentacion/img");
mkdirSync(salida, { recursive: true });

const proyecto = mkdtempSync(join(tmpdir(), "depscan-demo-"));
cpSync(join(raiz, "tests/fixtures/proyecto-demo"), proyecto, { recursive: true });
const perfil = mkdtempSync(join(tmpdir(), "depscan-perfil-"));

const app = await electron.launch({
  executablePath: exe,
  args: [
    proyecto,
    `--extensionDevelopmentPath=${join(raiz, "apps/vscode")}`,
    `--user-data-dir=${perfil}`,
    `--extensions-dir=${join(perfil, "ext")}`,
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-telemetry",
    "--new-window",
  ],
});
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 860 }).catch(() => {});
const espera = (ms) => win.waitForTimeout(ms);
const foto = async (nombre) => {
  await win.screenshot({ path: join(salida, `${nombre}.png`) });
  console.log("captura", nombre);
};
const comando = async (texto) => {
  await win.keyboard.press("F1");
  await espera(400);
  await win.keyboard.type(texto);
  await espera(600);
  await win.keyboard.press("Enter");
};

await win.waitForSelector(".monaco-workbench", { timeout: 60000 });
await espera(4000);
// Cerrar la bienvenida y abrir package.json
await win.keyboard.press("Control+P");
await espera(500);
await win.keyboard.type("package.json");
await espera(800);
await win.keyboard.press("Enter");
// Esperar el escaneo (barra de estado "DepScan: N vulnerables")
await win.waitForSelector('[id*="statusbar"] >> text=/DepScan: \\d+ vulnerables/', { timeout: 90000 });
await espera(1500);
await foto("vscode-subrayado");

// Hover sobre lodash (línea 5)
await win.keyboard.press("Control+G");
await win.keyboard.type("5:8");
await win.keyboard.press("Enter");
await espera(400);
await win.keyboard.press("Control+K");
await win.keyboard.press("Control+I");
await espera(2000);
await foto("vscode-hover");
await win.keyboard.press("Escape");

// Quick Fix
await win.keyboard.press("Control+.");
await espera(1500);
await foto("vscode-quickfix");
await win.keyboard.press("Escape");

// Panel lateral de hallazgos
await comando("DepScan: Escanear dependencias del proyecto");
await espera(1500);
await win.click('.activitybar [aria-label^="DepScan"]').catch(() => {});
await espera(1500);
const nodos = win.locator(".pane-body .monaco-list-row .monaco-tl-twistie.collapsible");
const n = await nodos.count();
for (let i = 0; i < Math.min(n, 2); i++) await nodos.nth(i).click().catch(() => {});
await espera(1000);
await foto("vscode-panel");

// Reporte completo
await comando("DepScan: Ver reporte completo");
await espera(3000);
await foto("vscode-reporte");

await app.close();
