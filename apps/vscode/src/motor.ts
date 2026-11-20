// Motor de la extensión: reutiliza @depscan/core (los mismos parsers, resolución,
// análisis y remediación verificada que la web y la CLI) con una caché en disco
// para que reabrir VS Code no vuelva a descargar los avisos de OSV.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OsvClient,
  readProjectDirectory,
  RegistryClient,
  scanProject,
  type Cache,
  type ScanReport,
  type ScanSources,
} from "@depscan/core";

/** Caché clave→valor con TTL persistida en un JSON (globalStorage de la extensión). */
export class CacheArchivo implements Cache {
  private datos = new Map<string, { v: string; exp: number }>();
  private pendiente: NodeJS.Timeout | undefined;
  private readonly archivo: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.archivo = join(dir, "cache-osv.json");
    if (existsSync(this.archivo)) {
      try {
        const ahora = Date.now();
        for (const [k, e] of Object.entries(JSON.parse(readFileSync(this.archivo, "utf8")))) {
          const entrada = e as { v: string; exp: number };
          if (entrada.exp > ahora) this.datos.set(k, entrada);
        }
      } catch {
        /* caché corrupta: se empieza de cero */
      }
    }
  }

  async get(key: string): Promise<string | undefined> {
    const e = this.datos.get(key);
    if (!e) return undefined;
    if (e.exp <= Date.now()) {
      this.datos.delete(key);
      return undefined;
    }
    return e.v;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.datos.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
    clearTimeout(this.pendiente);
    this.pendiente = setTimeout(() => this.guardar(), 1000);
  }

  get tamano(): number {
    return this.datos.size;
  }

  limpiar(): void {
    this.datos.clear();
    this.guardar();
  }

  guardar(): void {
    clearTimeout(this.pendiente);
    writeFileSync(this.archivo, JSON.stringify(Object.fromEntries(this.datos)));
  }
}

export interface OpcionesEscaneo {
  includeDev: boolean;
  estimate: boolean;
}

export class Motor {
  private fuentes: ScanSources;

  constructor(readonly cache: CacheArchivo) {
    this.fuentes = {
      osv: new OsvClient({ cache }),
      registry: new RegistryClient({ cache }),
    };
  }

  /** Para pruebas: reemplaza OSV y los registros por fuentes simuladas. */
  usarFuentes(fuentes: ScanSources): void {
    this.fuentes = fuentes;
  }

  get osv() {
    return this.fuentes.osv;
  }

  async escanear(carpeta: string, nombre: string, op: OpcionesEscaneo): Promise<ScanReport> {
    const archivos = await readProjectDirectory(carpeta);
    return scanProject(archivos, this.fuentes, {
      target: { name: nombre, source: "directory" },
      includeDev: op.includeDev,
      estimate: op.estimate,
      remediation: true,
    });
  }
}
