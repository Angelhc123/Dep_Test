import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dos niveles de prueba con Vitest (las de sistema tienen su propia config):
//   unitarias   → lógica del core aislada (parsers, versiones, análisis, remediación) con dobles de prueba
//   integracion → API Fastify + SQLite en memoria + autenticación, ensamblados de verdad (app.inject)
export default defineConfig({
  resolve: {
    alias: {
      "@depscan/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unitarias", include: ["packages/*/test/**/*.test.ts", "apps/vscode/test/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "integracion", include: ["apps/api/test/**/*.test.ts", "apps/cli/test/**/*.test.ts"] },
      },
    ],
    outputFile: { junit: "reports/junit/vitest.xml", html: "reports/tests/index.html" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**/*.ts", "apps/api/src/**/*.ts", "apps/vscode/src/manifiestos.ts"],
      exclude: ["**/*.d.ts"],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 65,
      },
    },
  },
});
