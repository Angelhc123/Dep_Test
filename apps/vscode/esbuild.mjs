// Empaqueta la extensión (y las pruebas e2e) en CommonJS para VS Code.
// @depscan/core se incluye desde el código fuente: el .vsix no tiene dependencias.
import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";

const produccion = process.argv.includes("--production");
const vigilar = process.argv.includes("--watch");
const core = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));

const comun = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode", "mocha"],
  alias: { "@depscan/core": core },
  sourcemap: !produccion,
  minify: produccion,
  logLevel: "info",
};

const configs = [
  { ...comun, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js" },
  { ...comun, entryPoints: ["test/e2e/extension.test.ts"], outfile: "dist-test/extension.test.js" },
];

if (vigilar) {
  for (const c of configs) await (await context(c)).watch();
} else {
  await Promise.all(configs.map((c) => build(c)));
}
