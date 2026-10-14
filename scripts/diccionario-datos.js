// Genera docs/DICCIONARIO_DATOS.md a partir del esquema real de SQLite.
// Aplica las migraciones de apps/api (requiere `tsc -b apps/api`) sobre una base en memoria
// y lee tablas, columnas, claves e índices con PRAGMA. Las descripciones viven aquí abajo.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Database } from "../apps/api/dist/db.js";

const SALIDA = process.argv[2] ?? "docs/DICCIONARIO_DATOS.md";

const TABLAS = {
  scans: "Historial de escaneos. Guarda el resumen para el listado y el reporte completo en JSON.",
  cache: "Caché persistente de respuestas de OSV, NVD y los registros npm/PyPI.",
  users: "Cuentas de usuario creadas al iniciar sesión con Google o GitHub.",
  identities: "Proveedores de identidad vinculados a cada usuario (una cuenta puede tener Google y GitHub).",
  sessions: "Sesiones de navegador (anónimas o de usuario), referenciadas por la cookie de sesión.",
};

const COLUMNAS = {
  scans: {
    id: "Identificador del escaneo (UUID).",
    created_at: "Fecha y hora del escaneo (ISO 8601, UTC).",
    target_name: "Nombre del proyecto escaneado (repositorio o archivo de manifiesto).",
    source: "Origen del escaneo: github, upload o directory.",
    commit_sha: "Commit analizado cuando el origen es un repositorio.",
    risk: "Semáforo de riesgo global: red, yellow o green.",
    summary_json: "Resumen del escaneo (conteos por severidad y riesgo) en JSON.",
    report_json: "Reporte completo (dependencias, vulnerabilidades y remediaciones) en JSON.",
    owner: 'Dueño del escaneo: "user:<id>" o "anon:<sesión>".',
    private: "1 si proviene de un repositorio privado (solo lo ve su dueño); 0 si no.",
  },
  cache: {
    key: "Clave de la entrada (fuente y consulta).",
    value: "Respuesta almacenada.",
    expires_at: "Expiración en milisegundos desde época Unix.",
  },
  users: {
    id: "Identificador del usuario (UUID).",
    email: "Correo electrónico informado por el proveedor.",
    name: "Nombre visible.",
    avatar_url: "URL de la foto de perfil.",
    created_at: "Fecha de registro (ISO 8601, UTC).",
  },
  identities: {
    provider: "Proveedor de identidad: google o github.",
    provider_user_id: "Identificador del usuario dentro del proveedor.",
    user_id: "Usuario de DepScan al que pertenece la identidad.",
    login: "Nombre de usuario en el proveedor (p. ej., login de GitHub).",
    email: "Correo informado por el proveedor.",
    access_token_enc: "Token de acceso cifrado con AES-256-GCM (solo GitHub, para leer repositorios).",
    scopes: "Permisos OAuth concedidos.",
    updated_at: "Última actualización (ISO 8601, UTC).",
  },
  sessions: {
    id: "Identificador aleatorio de la sesión (valor de la cookie).",
    user_id: "Usuario autenticado; NULL si la sesión es anónima.",
    created_at: "Creación en milisegundos desde época Unix.",
    expires_at: "Expiración en milisegundos desde época Unix.",
    data: "Datos auxiliares de la sesión en JSON (p. ej., estado OAuth).",
  },
};

// Crea el esquema con las migraciones reales y lo inspecciona con una conexión de solo lectura.
const dir = mkdtempSync(join(tmpdir(), "depscan-dd-"));
new Database(dir).close();
const db = new DatabaseSync(join(dir, "depscan.db"), { readOnly: true });

const version = db.prepare("PRAGMA user_version").get().user_version;
const tablas = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
  .all()
  .map((r) => r.name);

const celda = (s) => String(s ?? "").replace(/\|/g, "\\|");
const faltantes = [];
const out = [
  "# Diccionario de datos – DepScan",
  "",
  "> Archivo generado automáticamente por `scripts/diccionario-datos.js` (workflow *Diccionario de datos*). No editar a mano:",
  "> las descripciones se mantienen en el script y la estructura se lee del esquema real de SQLite.",
  "",
  `- **Motor:** SQLite (módulo nativo \`node:sqlite\`), archivo \`$DATA_DIR/depscan.db\``,
  `- **Versión del esquema (PRAGMA user_version):** ${version}`,
  `- **Tablas:** ${tablas.length}`,
  "",
  "## Resumen",
  "",
  "| Tabla | Descripción | Columnas |",
  "|---|---|---|",
];
const columnasDe = (t) => db.prepare(`PRAGMA table_info("${t}")`).all();
for (const t of tablas) out.push(`| [${t}](#${t}) | ${celda(TABLAS[t])} | ${columnasDe(t).length} |`);

for (const t of tablas) {
  if (!TABLAS[t]) faltantes.push(t);
  const fks = db.prepare(`PRAGMA foreign_key_list("${t}")`).all();
  const fkDe = Object.fromEntries(fks.map((f) => [f.from, `${f.table}(${f.to}) ON DELETE ${f.on_delete}`]));
  out.push("", `## ${t}`, "", TABLAS[t] ?? "_Sin descripción._", "");
  out.push("| Columna | Tipo | Nulo | Por defecto | Clave | Descripción |", "|---|---|---|---|---|---|");
  for (const c of columnasDe(t)) {
    const clave = [c.pk ? "PK" : "", fkDe[c.name] ? `FK → ${fkDe[c.name]}` : ""].filter(Boolean).join(", ");
    const desc = COLUMNAS[t]?.[c.name];
    if (!desc) faltantes.push(`${t}.${c.name}`);
    out.push(
      `| ${c.name} | ${c.type} | ${c.notnull || c.pk ? "No" : "Sí"} | ${celda(c.dflt_value ?? "")} | ${celda(clave)} | ${celda(desc ?? "_Sin descripción._")} |`,
    );
  }
  const indices = db
    .prepare(`PRAGMA index_list("${t}")`)
    .all()
    .filter((i) => i.origin === "c");
  if (indices.length) {
    out.push("", "**Índices**", "", "| Índice | Columnas | Único |", "|---|---|---|");
    for (const i of indices) {
      const cols = db
        .prepare(`PRAGMA index_xinfo("${i.name}")`)
        .all()
        .filter((x) => x.key)
        .map((x) => x.name + (x.desc ? " DESC" : ""));
      out.push(`| ${i.name} | ${cols.join(", ")} | ${i.unique ? "Sí" : "No"} |`);
    }
  }
}

out.push("", "## Relaciones", "", "```mermaid", "erDiagram");
for (const t of tablas) {
  for (const f of db.prepare(`PRAGMA foreign_key_list("${t}")`).all()) {
    out.push(`  ${f.table} ||--o{ ${t} : "${f.from}"`);
  }
}
out.push("```", "");
db.close();
rmSync(dir, { recursive: true, force: true });

writeFileSync(SALIDA, out.join("\n"));
console.log(`Diccionario escrito en ${SALIDA} (${tablas.length} tablas, esquema v${version}).`);
if (faltantes.length) {
  console.error(`Faltan descripciones en scripts/diccionario-datos.js: ${faltantes.join(", ")}`);
  process.exit(1);
}
