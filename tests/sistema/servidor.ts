// Arranca el servidor de pruebas como proceso aparte (igual que en producción)
// y espera a que responda /api/health.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Servidor {
  url: string;
  dataDir: string;
  logs: string[];
  detener(): Promise<void>;
}

async function puertoLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function iniciarServidor(env: Record<string, string> = {}): Promise<Servidor> {
  const port = await puertoLibre();
  const dataDir = env.DATA_DIR ?? mkdtempSync(join(tmpdir(), "depscan-sistema-"));
  const logs: string[] = [];
  const proc: ChildProcess = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "tests/support/servidor-pruebas.mjs"],
    { env: { ...process.env, ...env, PORT: String(port), DATA_DIR: dataDir, LOG_LEVEL: "info" } },
  );
  proc.stdout?.on("data", (d) => logs.push(String(d)));
  proc.stderr?.on("data", (d) => logs.push(String(d)));

  const url = `http://127.0.0.1:${port}`;
  const limite = Date.now() + 15_000;
  for (;;) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) break;
    } catch {
      /* aún arrancando */
    }
    if (Date.now() > limite) throw new Error(`El servidor no arrancó:\n${logs.join("")}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  return {
    url,
    dataDir,
    logs,
    detener: () =>
      new Promise((resolve) => {
        if (proc.exitCode !== null) return resolve();
        proc.once("exit", () => resolve());
        proc.kill();
      }),
  };
}
