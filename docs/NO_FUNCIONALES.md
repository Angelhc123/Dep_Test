# Aspectos no funcionales: DepScan

Este documento cubre cinco aspectos que se van a evaluar: **manejo de sesiones, historial, caché, logs y telemetría**. Para cada uno explica qué hace DepScan, dónde está el código, qué prueba automatizada lo demuestra y cómo enseñarlo en la presentación.

| Aspecto | Implementación | Evidencia automatizada |
|---|---|---|
| Sesiones | Cookie `depscan_sid` HttpOnly, SameSite=Lax, Secure con HTTPS y vigencia de 30 días. En SQLite solo se guarda el **hash SHA-256** del token, y las sesiones vencidas se purgan. | 3 pruebas de integración, 2 de sistema y 1 escenario BDD |
| Historial | Cada escaneo queda en SQLite asociado a su dueño (`anon:<sesión>` o `user:<id>`), con paginación, comparación y borrado solo por el dueño. Al iniciar sesión, los escaneos anónimos pasan a la cuenta. | 2 de integración, 3 de sistema, 1 de UI y 3 escenarios BDD |
| Caché | Caché persistente en SQLite (tabla `cache` con TTL): 24 h para OSV y NVD, 1 h para los registros npm/PyPI. Sobrevive a los reinicios del contenedor y está **instrumentada** para medir aciertos y fallos. | 4 de integración |
| Logs | Logs JSON estructurados (pino):<br>• cada petición lleva un **ID de correlación** (`X-Request-Id`);<br>• cada escaneo emite un evento de negocio `event="scan"`;<br>• cookies y tokens se **redactan** (nunca aparecen). | 4 de integración y 2 de sistema |
| Telemetría | Métricas en vivo en `/api/metrics` (JSON) y `/metrics` (formato **Prometheus**):<br>• peticiones, latencia p50/p95/p99 y errores 5xx;<br>• escaneos por semáforo y por origen;<br>• aciertos de caché, sesiones vigentes y tamaño del historial.<br>La página **Estado** de la web muestra todo en vivo. Con `METRICS_TOKEN` el acceso queda protegido. | 4 de integración, 1 de sistema, 1 de UI y 1 escenario BDD |

Todas estas pruebas corren solas en cada push, dentro del workflow *Pruebas y reportes* (ver `docs/AUTOMATIZACION_PRUEBAS.md`). Las de integración están en `apps/api/test/no-funcionales.test.ts`.

---

## 1. Manejo de sesiones

**Cómo funciona.** El primer escaneo de un visitante crea una sesión anónima.
- El navegador guarda un token aleatorio de 32 bytes en una cookie `HttpOnly`, que JavaScript no puede leer, lo que mitiga XSS.
- El servidor guarda solo `sha256(token)`, así que una filtración de la base de datos no permite secuestrar sesiones.
- Si el usuario inicia sesión con Google o GitHub:
  - la sesión se asocia a su cuenta;
  - el token OAuth de GitHub se guarda **cifrado con AES-256-GCM** (`SESSION_SECRET`).
- Las sesiones vencidas se eliminan cada 6 horas (`purgeExpired`).

| Código | Qué contiene |
|---|---|
| `apps/api/src/auth/routes.ts` | `ensureSession`, `setSessionCookie`, `SESSION_TTL_MS` |
| `apps/api/src/auth/crypto.ts` | Tokens aleatorios y cifrado AES-GCM |
| `apps/api/src/db.ts` | Tabla `sessions`, `createSession`, `purgeExpired` |

**Pruebas.**
- `no-funcionales.test.ts › Sesiones`: la cookie es HttpOnly, Lax y dura 30 días; una cookie inventada no da acceso; las sesiones vencidas se purgan.
- `api-sistema.test.ts`: el historial se guarda en la sesión y no en la de otros, y solo el dueño puede borrar.
- BDD `cu08-historial.feature`: otra persona no ve mi historial.

## 2. Historial

**Cómo funciona.**
- Cada escaneo se guarda en la tabla `scans` con dueño, semáforo, resumen y reporte completo.
- `GET /api/scans?limit=&offset=` pagina los escaneos del más reciente al más antiguo, con un límite de 1 a 100.
- La web permite **comparar** dos escaneos y **eliminar** con confirmación.
- Los escaneos de repos privados solo los ve su dueño.

**Pruebas.**
- `no-funcionales.test.ts › Historial`: orden y paginación; rechazo de un límite fuera de rango.
- `api-sistema.test.ts`: el historial **sobrevive a un reinicio del servidor**.
- UI `Historial › … se eliminan con confirmación`.
- BDD CU-08: la revisión queda en mi historial y se elimina con confirmación.

## 3. Caché

**Cómo funciona.**
- OSV, NVD y los registros se consultan a través del puerto `Cache` del core.
- En producción el adaptador es SQLite (`db.cache()`), así que la caché persiste en el volumen de Railway.
- Un segundo escaneo del mismo proyecto no vuelve a descargar el detalle de las vulnerabilidades.
- `Telemetry.instrumentCache` envuelve la caché para contar aciertos, fallos y escrituras.

**Pruebas.**
- `integracion-fuentes.test.ts`, con los clientes HTTP reales contra un OSV local:
  - el segundo escaneo **no hace peticiones** de detalle;
  - la caché sobrevive a cerrar y reabrir la base;
  - se reintenta ante un 503.
- `no-funcionales.test.ts`: la caché instrumentada mide `hitRate`, y la caché vencida se purga.

## 4. Logs

**Cómo funciona.** Fastify con pino escribe una línea JSON por evento; Railway las recoge y permite filtrarlas.
- **ID de correlación.**
  - Cada petición recibe un `reqId`. Si el cliente envía `X-Request-Id` válido, se respeta; si no, se genera un UUID.
  - El servidor lo devuelve en la cabecera `X-Request-Id`, así que un error que reporte el usuario se encuentra en el log por ese ID.
- **Eventos de negocio.** Cada escaneo emite:

  ```json
  {"level":30,"reqId":"7f3c…","event":"scan","scanId":"…","source":"upload","owner":"anon",
   "dependencies":3,"vulnerable":2,"risk":"red","durationMs":412,"msg":"escaneo completado"}
  ```

- **Privacidad.**
  - `redact` elimina `cookie`, `authorization` y `set-cookie` de cualquier log.
  - El dueño solo se registra como `anon` o `user`, nunca con su ID.
- **Errores.** Los 5xx se registran con el stack trace, pero el cliente solo recibe "Error interno del servidor".

**Pruebas.**
- `no-funcionales.test.ts › Logs`:
  - el `X-Request-Id` coincide con el del log;
  - un ID inseguro se reemplaza;
  - se emite el evento `scan`;
  - **las cookies nunca aparecen en el log**.
- `api-sistema.test.ts`: el servidor real escribe logs JSON y el evento del escaneo tiene el mismo `reqId` que la respuesta.

## 5. Telemetría

**Cómo funciona.** `apps/api/src/telemetry.ts` mide en memoria y lee de SQLite lo persistente:

| Grupo | Métricas |
|---|---|
| HTTP | Peticiones totales y por ruta, respuestas por clase (2xx/4xx/5xx), tasa de error 5xx, latencia p50/p95/p99 (últimas 500 peticiones) |
| Escaneos | Total, fallidos, por origen (subida, GitHub), por semáforo, dependencias analizadas y vulnerables, duración p50/p95 |
| Caché | Aciertos, fallos, escrituras, tasa de aciertos, entradas vigentes |
| Sesiones | Sesiones vigentes, sesiones con cuenta, usuarios registrados |
| Historial | Escaneos guardados |
| Proceso | Tiempo activo, memoria residente |

**Formas de consultarla:**
- **Web → Estado** (`/#/estado`): un panel que se actualiza cada 5 segundos.
- **`GET /api/metrics`**: JSON.
- **`GET /metrics`**: formato de texto de Prometheus. Se puede conectar a Prometheus/Grafana sin cambiar código. Ejemplo:

  ```
  # TYPE depscan_scans_by_risk_total counter
  depscan_scans_by_risk_total{risk="red"} 2
  depscan_http_latency_ms{quantile="p95"} 18.8
  depscan_sessions_active 3
  ```

- **Protección opcional:** si la variable `METRICS_TOKEN` está definida, ambos endpoints exigen `Authorization: Bearer <token>`. Los archivos estáticos de la web se agrupan como `(web)` para no crear una serie por cada archivo.

**Pruebas.**
- `no-funcionales.test.ts › Telemetría`:
  - conteos tras escanear;
  - formato Prometheus;
  - token requerido;
  - tasa de aciertos de la caché.
- `api-sistema.test.ts`: las métricas responden en el servidor real.
- UI `Estado (telemetría)`: un escaneo nuevo incrementa el contador en la página.
- BDD `no-funcionales-estado.feature`: el administrador ve el escaneo con riesgo alto en la telemetría.

---

## Cómo demostrarlo en la presentación (≈3 minutos)

**Preparación:**

```bash
npm run build
node tests/support/servidor-pruebas.mjs        # http://127.0.0.1:4321 (OSV simulado, sin internet)
# o la app real:  npm start                    # http://localhost:3000
```

1. **Telemetría (40 s).** Abre `http://127.0.0.1:4321/#/estado` en una pestaña. En otra pestaña, haz un escaneo subiendo `tests/fixtures/proyecto-demo`. Vuelve a **Estado**: en unos 5 s sube el contador de escaneos, aparece en *Riesgo alto* y la ruta `POST /api/scans` muestra su latencia p95. Abre el enlace *formato Prometheus* para mostrar `/metrics`.
2. **Logs y correlación (40 s).** En las DevTools, pestaña *Network*, elige la petición `scans` y muestra la cabecera de respuesta `X-Request-Id`. En la terminal del servidor busca ese ID: aparece la línea `"event":"scan"` con el semáforo y la duración. Señala que no hay cookies en el log.
3. **Sesiones (30 s).** En DevTools → *Application → Cookies*, muestra `depscan_sid` con **HttpOnly** y **SameSite Lax**. Abre una ventana de incógnito y entra a *Historial*: aparece vacío porque es otra sesión.
4. **Historial (30 s).** Reinicia el servidor (Ctrl+C y volver a lanzarlo con el mismo `DATA_DIR`) y muestra que el historial sigue ahí. Luego compara dos escaneos y elimina uno.
5. **Caché (20 s).** Con la app real (`npm start`), escanea dos veces el mismo proyecto. En **Estado**, la *tasa de aciertos* de la caché sube y el segundo escaneo es más rápido.
6. **Evidencia automatizada (20 s).** Abre el panel de GitHub Pages (`/sistema` y `/unitarias`) y muestra las pruebas *"el historial sobrevive a un reinicio"*, *"nunca escribe cookies de sesión en los logs"* y *"/metrics expone el formato de Prometheus"*.

## Variables de entorno relacionadas

| Variable | Uso |
|---|---|
| `SESSION_SECRET` | Clave para cifrar los tokens OAuth guardados. Obligatoria en producción si se usa login. |
| `DATA_DIR` | Carpeta de SQLite: sesiones, historial y caché (en Railway, el volumen). |
| `LOG_LEVEL` | `info` por defecto; `debug` para más detalle, `silent` en pruebas. |
| `METRICS_TOKEN` | Si se define, protege `/api/metrics` y `/metrics` con un Bearer token. |
| `SCAN_RATE_LIMIT` | Máximo de escaneos por IP y minuto (20 por defecto). |
