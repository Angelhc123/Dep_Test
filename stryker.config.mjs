// Pruebas de mutación (Stryker) sobre la lógica de dominio de @depscan/core.
// Stryker introduce pequeños cambios ("mutantes") en el código —invierte un <,
// cambia un && por ||, borra una línea— y vuelve a correr las pruebas unitarias.
// Si alguna prueba falla, el mutante muere (bien); si todas pasan, sobrevive y
// revela un caso que las pruebas no verifican. Reporte: reports/mutation/index.html
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  plugins: ["@stryker-mutator/vitest-runner"],
  // Solo la lógica pura (versiones, parsers, resolución y análisis). Se excluyen los
  // adaptadores de red (OSV, NVD, registros, GitHub) y el renderizado HTML.
  mutate: [
    "packages/core/src/versions/**/*.ts",
    "packages/core/src/parsers/**/*.ts",
    "packages/core/src/resolver/**/*.ts",
    "packages/core/src/analysis/**/*.ts",
    "!packages/core/src/analysis/cwe-guidance.ts",
  ],
  coverageAnalysis: "perTest",
  reporters: ["html", "json", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Umbrales: <50 % rompe el build; 50–70 aviso; >80 alto.
  thresholds: { high: 80, low: 70, break: 50 },
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};
