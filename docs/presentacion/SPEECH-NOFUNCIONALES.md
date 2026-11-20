# Speech · Aspectos no funcionales y telemetría

Guion para `DepScan-NoFuncionales.html` (6 diapositivas: portada, 4 de contenido y cierre). Son las diapositivas 13–16 de la presentación de calidad.

## Diapositiva 2 · Aspectos no funcionales (≈ 1 min 30 s)

> Nos pidieron evaluar cinco aspectos no funcionales. La tabla tiene, para cada uno, cómo lo hace DepScan, en qué código está y qué prueba lo demuestra.
>
> - **Sesiones.** Usamos una cookie que JavaScript no puede leer (*HttpOnly*) y que dura 30 días. En la base de datos **no guardamos la cookie, sino su hash**, y los tokens de GitHub van cifrados.
> - **Historial.** Cada escaneo tiene dueño: una sesión anónima o un usuario. Solo el dueño lo ve y lo borra, y **sobrevive a un reinicio**.
> - **Caché.** Está en SQLite con vencimiento: 24 horas para OSV y una hora para los registros. Se prueba que el segundo escaneo no vuelve a consultar OSV.
> - **Logs.** Son JSON estructurados. Cada petición tiene un **ID de correlación**, y probamos que **las cookies nunca aparecen en el log**.
> - **Telemetría.** Se las muestro en las siguientes diapositivas.

---

## Diapositiva 3 · Telemetría: la página Estado (≈ 1 min)

> La telemetría se ve **dentro de la aplicación**, en el menú **Estado**, y se actualiza cada cinco segundos.
>
> Arriba están las cifras clave: peticiones atendidas, **latencia p95** (el 95 % de las peticiones responde en menos de ese tiempo), porcentaje de errores del servidor y escaneos realizados.
>
> Al centro, **gráficos por minuto de la última hora**: peticiones con su latencia, y escaneos. Abajo, sesiones vigentes, historial, caché, escaneos por semáforo y las rutas más usadas.
>
> Todo sale de un endpoint, `/api/metrics`. Existe también `/metrics` en formato **Prometheus**, el estándar de la industria, por si se quiere conectar a Grafana.

---

## Diapositiva 4 · Telemetría: evidencia estadística (≈ 1 min)

> El profesor preguntó si la telemetría eran gráficos estadísticos. **Sí, y estos son datos reales medidos por la propia aplicación.**
>
> Corrimos seis minutos de uso simulado sobre DepScan real. El resumen está en la línea de arriba, y en esa corrida hubo **cero errores del servidor**:
> - unas 900 peticiones;
> - 445 escaneos, 297 en rojo y 148 en verde;
> - latencia p95 de unos 5 milisegundos.
>
> **El gráfico de la izquierda** son las peticiones por minuto, en barras, con la latencia p95 como línea en el eje derecho. Se ve que, aunque la carga sube y baja, **la latencia se mantiene estable**.
>
> **El de la derecha** son los escaneos completados por minuto.
>
> Un detalle honesto: en esta corrida OSV estaba simulado. Por eso la latencia es tan baja; con OSV real cada escaneo tarda unos segundos, por la red.

---

## Diapositiva 5 · Cómo se generaron los datos (≈ 1 min 15 s)

> Para que no quede duda, este es **el proceso exacto** con el que se generaron las gráficas:
> 1. El script `scripts/telemetria-demo.mjs` levanta DepScan completo: API, base de datos y web.
> 2. Simula uso: escanea tres proyectos de ejemplo, consulta el historial y la salud, y además manda **peticiones inválidas a propósito**. Esas son las 4xx que ven abajo a la derecha.
> 3. Cada diez segundos lee `/api/metrics` y guarda la muestra.
> 4. Al final guarda todo en `docs/presentacion/datos/telemetria-demo.json`.
> 5. Otro script, `graficos.mjs`, dibuja estas gráficas **desde ese archivo**.
>
> Cualquiera puede repetirlo con un comando. Arriba a la derecha está la curva acumulada: peticiones y escaneos crecen juntos, y **cada escaneo terminó en el historial** (las dos líneas coinciden).
>
> Y abajo a la izquierda, la **evidencia de producción**: es la salida real de `/metrics` de nuestro servidor en Railway, en formato Prometheus.

---

