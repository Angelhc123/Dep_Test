# ADR-008: Despliegue en Railway como un solo servicio con SQLite en volumen

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

El proyecto se despliega en Railway. Tiene una API, una web estática y necesita persistir el historial y la caché.

## Decisión

- Una sola imagen (`Dockerfile`): Fastify sirve `/api/*` y el build de React en `/`.
- SQLite (`node:sqlite`) en un volumen montado en `/data` (`DATA_DIR`).
- Healthcheck en `/api/health`, cierre ordenado con `SIGTERM` y `trustProxy` para leer la IP real en el límite de escaneos.
- Como en un servidor no hay carpeta local, se agrega el escaneo de repos públicos de GitHub en un commit exacto.

## Alternativas descartadas

- Dos servicios (web y API): más configuración (CORS y dos dominios) sin beneficio a esta escala.
- PostgreSQL: requiere otro servicio; queda como evolución si se necesitan varias réplicas.
- Nixpacks/Railpack sin Dockerfile: funciona, pero el Dockerfile hace el build reproducible y verificable.

## Consecuencias

- Una sola réplica (SQLite no admite varias instancias escribiendo el mismo archivo).
- El contenedor corre como root por los permisos del volumen.
