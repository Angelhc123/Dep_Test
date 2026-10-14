# depscan — escáner de dependencias vulnerables

Lee los manifiestos de un proyecto (`package.json`, `package-lock.json`, `requirements.txt`), obtiene la **versión
exacta** de cada dependencia directa y transitiva, la cruza con **OSV** (y opcionalmente **NVD**) y aplica lógica propia:
deduplicación CVE/GHSA/PYSEC, prioridad por severidad, versión mínima segura con aviso de salto mayor y semáforo de riesgo.

- **Web** (React) para subir archivos o escanear un repo de GitHub, con historial y comparación.
- **Login con Google y GitHub**: importa tus repos (también los privados) y escanéalos con un clic.
- **Soluciones por hallazgo**: versión recomendada, todas las versiones seguras de la librería, comandos
  (`npm install`, `npm update`, `overrides`, `pip install`) y, si sigues con la versión vulnerable, mitigaciones y parches.
- **Reporte descargable en HTML y PDF.**
- **API** REST (Fastify + SQLite).
- **CLI** para CI: código de salida ≠ 0 si hay hallazgos sobre el umbral.
- Despliegue en **Railway** con un solo servicio.

> Planteamiento: [`proyecto.md`](proyecto.md) · Arquitectura: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) ·
> Despliegue: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) · Benchmark: [`docs/informe/`](docs/informe/)

## Requisitos

- Node.js **24** y Visual Studio Code (al abrir la carpeta sugiere las extensiones). No hace falta otro IDE.

## Uso local

```bash
npm install
npm run dev        # API en :3000 + web en :5173 (con recarga)
```

Abre http://localhost:5173. Para producción local: `npm run build && npm start` (todo en http://localhost:3000).

### CLI

```bash
npm run build
npm run scan -- ./mi-proyecto                       # tabla en la terminal
npm run scan -- ./mi-proyecto -f html -o reporte.html
npm run scan -- --github OWASP/NodeGoat --fail-on high
npm run scan -- --help
```

| Opción                                        | Efecto                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--fail-on critical\|high\|medium\|low\|none` | Umbral para salir con código 1 (por defecto `critical`).                             |
| `--estimate`                                  | Sin lockfile, estima la versión con el registro npm/PyPI (se marca como estimación). |
| `--nvd`                                       | Usa el CVSS oficial de NVD (`NVD_API_KEY` opcional).                                 |
| `--no-dev`                                    | Ignora dependencias de desarrollo.                                                   |
| `--no-remediation`                            | No calcula versiones seguras ni mitigaciones (más rápido).                           |

## Pruebas y calidad

```bash
npm test           # Vitest: core, API y CLI, sin internet
npm run typecheck
npm run lint
npm run benchmark  # depscan vs npm audit vs osv-scanner en repos fijados por commit
```

## Estructura

```
packages/core   motor del escáner (sin dependencias de runtime)
apps/api        Fastify + SQLite; sirve también la web
apps/cli        línea de comandos
apps/web        React + Vite + Tailwind
benchmark       comparación reproducible con otras herramientas
docs            arquitectura, despliegue, decisiones e informe
```

## Limitaciones

- Indica que una versión tiene una falla **conocida**, no si el código usa la función afectada.
- Solo detecta lo ya publicado en OSV/NVD.
- Sin lockfile la precisión baja.
- Requiere internet y depende de la disponibilidad de OSV/NVD.
