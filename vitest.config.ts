import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@depscan/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/api/test/**/*.test.ts", "apps/cli/test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**/*.ts", "apps/api/src/**/*.ts"],
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
