import { defineConfig, devices } from "@playwright/test";

// PRUEBAS DE INTERFAZ DE USUARIO (Playwright). Levantan DepScan real con fuentes
// simuladas (tests/support/servidor-pruebas.mjs) y manejan un Chromium de verdad.
// Requiere `npm run build`. Reporte: reports/ui/index.html (con videos y trazas).
const PORT = 4321;

export default defineConfig({
  testDir: "tests/ui",
  outputDir: "reports/ui-resultados",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/ui", open: "never" }],
    ["junit", { outputFile: "reports/junit/ui.xml" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "es-PE",
    // Evidencia para el reporte: video y traza de cada prueba, captura al final.
    video: "on",
    trace: "on",
    screenshot: "on",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node --disable-warning=ExperimentalWarning tests/support/servidor-pruebas.mjs",
    url: `http://127.0.0.1:${PORT}/api/health`,
    env: { PORT: String(PORT), SCAN_RATE_LIMIT: "1000" },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
