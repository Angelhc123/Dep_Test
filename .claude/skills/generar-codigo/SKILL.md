---
name: generar-codigo
description: Genera o modifica código del escáner de dependencias (depscan) respetando la arquitectura del monorepo. Úsala al crear parsers, fuentes (OSV/NVD/registros), análisis, rutas de la API, comandos de la CLI o pantallas React.
---

# Generar código para depscan

Antes de escribir código, lee `docs/ARQUITECTURA.md` (secciones 3 y 4).

## Reglas de arquitectura

- `packages/core` es el motor. **No** importa Fastify, SQLite, React ni nada de `apps/`.
  - Solo usa APIs nativas de Node (`fetch`, `node:fs/promises`, `node:path`).
  - Cero dependencias de runtime.
- Las fuentes externas (OSV, NVD, registros npm/PyPI, caché) se acceden **solo a través de los puertos** de `packages/core/src/sources/ports.ts`. Un adaptador nuevo implementa un puerto, no se llama desde el dominio directamente.
- La comparación de versiones vive en `packages/core/src/versions/` (implementación propia, semver y PEP 440). No agregar la librería `semver`.
- `apps/api` (Fastify), `apps/cli` y `apps/web` (React + Vite) son entradas que consumen `@depscan/core`.
- La web importa de `@depscan/core` solo con `import type`.

## Convenciones

- TypeScript estricto, ESM, imports relativos con extensión `.js`.
- Nombres de código en inglés; comentarios y mensajes al usuario en español.
- Nada de `any`; las respuestas externas (OSV/NVD) se validan con guardas antes de usarse.
- Cada función pública del core lleva test en `packages/core/test/` (Vitest). Las pruebas de red usan fixtures o fuentes simuladas, nunca internet.

## Despliegue (Railway)

- Un solo servicio: la API sirve también el build de `apps/web`.
- Configuración solo por variables de entorno: `PORT`, `DATA_DIR`, `NVD_API_KEY`, `GITHUB_TOKEN`.
- Nada debe escribir fuera de `DATA_DIR` (es el volumen persistente).

## Al terminar

Ejecuta `npm run build`, `npm run typecheck` y `npm test` desde la raíz y corrige los errores.
