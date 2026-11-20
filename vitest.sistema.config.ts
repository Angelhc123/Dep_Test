import { defineConfig } from "vitest/config";

// PRUEBAS DE SISTEMA: requieren `npm run build` (prueban los binarios compilados).
export default defineConfig({
  test: {
    name: "sistema",
    include: ["tests/sistema/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    outputFile: { junit: "reports/junit/sistema.xml", html: "reports/sistema/index.html" },
  },
});
