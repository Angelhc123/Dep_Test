import { defineConfig, devices } from "@playwright/test";
import { cucumberReporter, defineBddConfig } from "playwright-bdd";

// PRUEBAS DE ACEPTACIÓN DE USUARIO (BDD). Las historias están en Gherkin en
// español (tests/aceptacion/features, una por caso de uso del FD03) y se ejecutan
// en el navegador con Playwright. Reporte Cucumber: reports/bdd/index.html
const PORT = 4322;

const testDir = defineBddConfig({
  features: "tests/aceptacion/features/*.feature",
  steps: "tests/aceptacion/steps/*.ts",
  outputDir: ".features-gen",
  language: "es",
});

export default defineConfig({
  testDir,
  outputDir: "reports/bdd-resultados",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    cucumberReporter("html", { outputFile: "reports/bdd/index.html", externalAttachments: false }),
    cucumberReporter("json", { outputFile: "reports/bdd/cucumber.json" }),
    ["junit", { outputFile: "reports/junit/aceptacion.xml" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "es-PE",
    acceptDownloads: true,
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "aceptacion", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node --disable-warning=ExperimentalWarning tests/support/servidor-pruebas.mjs",
    url: `http://127.0.0.1:${PORT}/api/health`,
    env: { PORT: String(PORT), SCAN_RATE_LIMIT: "1000" },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
