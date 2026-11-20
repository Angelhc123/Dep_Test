// PRUEBAS DE SISTEMA de la CLI: se ejecuta el binario compilado como lo haría
// un usuario o un pipeline de CI y se verifican salida y códigos de salida.
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const cli = (...args: string[]) =>
  spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "apps/cli/dist/index.js", ...args], {
    encoding: "utf8",
  });

describe("Sistema: CLI", () => {
  it("--help muestra el uso y termina con código 0", () => {
    const out = execFileSync(process.execPath, ["apps/cli/dist/index.js", "--help"], { encoding: "utf8" });
    expect(out).toContain("Uso:");
    expect(out).toContain("--fail-on");
  });

  it("un formato no válido termina con error y código distinto de 0", () => {
    const r = cli("--format", "xml", "tests/fixtures/proyecto-seguro");
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toContain("Formato no válido");
  });

  it("una carpeta sin manifiestos no falla el pipeline", () => {
    const r = cli("--no-color", "tests/sistema");
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("Manifiestos encontrados: 0");
  });
});
