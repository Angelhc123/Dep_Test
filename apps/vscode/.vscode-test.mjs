import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@vscode/test-cli";

mkdirSync(fileURLToPath(new URL("../../reports/junit/", import.meta.url)), { recursive: true });

// Pruebas e2e: abre un VS Code real con la extensión cargada sobre test/e2e/proyecto.
// En CI se genera además un JUnit para el panel de pruebas (reports/junit/vscode.xml).
export default defineConfig({
  files: "dist-test/**/*.test.js",
  workspaceFolder: "test/e2e/proyecto",
  launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
  mocha: {
    timeout: 60000,
    ui: "bdd",
    reporter: process.env.CI ? "xunit" : "spec",
    reporterOptions: {
      output: fileURLToPath(new URL("../../reports/junit/vscode.xml", import.meta.url)),
      suiteName: "Extensión VS Code (e2e)",
    },
  },
});
