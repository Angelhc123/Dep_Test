# Speech · Presentación de calidad de DepScan

Guion para `DepScan-Calidad.html` (20 diapositivas). Duración estimada: **18–20 minutos** más preguntas.
Está pensado para decirse en voz alta: usen las ideas, no lo lean palabra por palabra.

> **Antes de presentar**, dejen abiertas en el navegador:
> - el panel: <https://angelhc123.github.io/Dep_Test/>
> - SonarCloud: <https://sonarcloud.io/project/overview?id=Angelhc123_Dep_Test>
> - Code scanning: <https://github.com/Angelhc123/Dep_Test/security/code-scanning>
> - la última ejecución de *Pruebas y reportes*: <https://github.com/Angelhc123/Dep_Test/actions/workflows/pruebas.yml>
>
> Si piden "muéstrenlo", lo abren en vivo: todo lo que aparece en las diapositivas está publicado ahí.

**Reparto sugerido:**

| Bloque | Diapositivas | Quién |
|---|---|---|
| Entregables, automatización y análisis estático | 1–6 | Angel Gadiel Hernández Cruz |
| Pruebas automatizadas (unitarias a aceptación) | 7–12 | Richard Alexis Podestá Condori |
| No funcionales, telemetría, reto VS Code y cierre | 13–20 | Gustavo Alonso Sagua Ramos |

---

## Diapositiva 1 · Portada (≈ 30 s)

> En esta segunda presentación mostramos **cómo sabemos que DepScan funciona bien**. Cubrimos tres partes:
> 1. el análisis estático del código;
> 2. las pruebas automatizadas, en seis niveles;
> 3. los aspectos no funcionales, con la telemetría.
>
> Al final mostramos el reto: un **plugin de VS Code con skills y un agente**.
>
> Todo lo que van a ver está publicado en este enlace, `angelhc123.github.io/Dep_Test`, y **se regenera solo en cada cambio al código**.

---

## Diapositiva 2 · Lo que pedía el curso (≈ 1 min)

> Esta tabla es el índice de la presentación: cada entregable de la unidad, con qué herramienta lo hicimos, el resultado y dónde está la evidencia.
>
> - **Análisis estático:** SonarCloud, Semgrep, Snyk y Hadolint. El Quality Gate está aprobado.
> - **Unitarias y mutación:** 166 unitarias y un 61 % de mutación.
> - **Integración y sistema:** 26 y 23 pruebas.
> - **Interfaz:** 16 pruebas con video.
> - **Aceptación:** 12 escenarios escritos en español.
> - **No funcionales:** documentados y probados.
> - **El reto:** 8 pruebas en un VS Code real y la extensión descargable.
>
> Lo más importante está en la nota de abajo: **nada se ejecuta a mano para esta presentación**. Lo corre GitHub Actions en cada push.

---

## Diapositiva 3 · Un push dispara tres workflows (≈ 1 min 15 s)

> Así está montada la automatización, en la carpeta `.github/workflows`. Cada `git push` a `main` dispara tres workflows en paralelo:
>
> **Arriba, `calidad.yml`, el análisis estático.** Tiene cinco jobs:
> - tests con cobertura, que alimentan a **SonarCloud**;
> - **Semgrep**;
> - **Snyk Code** (análisis del código);
> - **Snyk Open Source** (dependencias);
> - **Hadolint** para el Dockerfile.
>
> Los resultados de Semgrep, Snyk y Hadolint se suben en formato SARIF a la pestaña *Code scanning* de GitHub.
>
> **En el centro, `pruebas.yml`.** Corre en paralelo seis jobs, uno por tipo de prueba, y al final el job **`publicar`**. Ese job junta todos los reportes HTML, genera el panel y el archivo `resumen.json`, y lo publica en **GitHub Pages**.
>
> **Abajo, `ci.yml`**, la integración continua: lint, tipos, pruebas y build. Al final **DepScan se escanea a sí mismo** y falla si encuentra algo alto o crítico. Railway solo despliega si esto pasa.

---

## Diapositiva 4 · El panel de pruebas y calidad (≈ 45 s)

> Este es el panel publicado. En la parte de arriba están los totales:
> - **251 pruebas automatizadas, 0 fallidas**;
> - 93 % de cobertura de líneas y 77 % de ramas;
> - 61 % de mutación.
>
> Cada fila de la tabla es un tipo de prueba, con lo que verifica y un enlace a su **reporte HTML** original. Arriba se ve el commit exacto que se probó y un enlace a la ejecución de GitHub Actions: así cualquiera puede comprobar que estos números son reales.

---

## Diapositiva 5 · SonarCloud (≈ 1 min)

> SonarCloud analiza la calidad del código: bugs, vulnerabilidades, *code smells*, duplicación y cobertura.
>
> El **Quality Gate está aprobado**, con 0 bugs, 0 vulnerabilidades y nota **A** en confiabilidad, seguridad y mantenibilidad. La duplicación es de 1,2 %.
>
> Quiero contar cómo llegamos aquí, porque **no partimos en verde**. La primera vez que SonarCloud corrió completo marcó **8 bugs y 1 vulnerabilidad**: confiabilidad D y seguridad C. Las corregimos en el código:
> - ordenamientos sin comparador;
> - una expresión regular mal agrupada, que era un bug real;
> - dos paneles que no se podían cerrar con el teclado;
> - un riesgo de *path traversal* en la opción `--output` de la CLI.
>
> La configuración está en `sonar-project.properties` y en el job SonarCloud de `calidad.yml`.

---

## Diapositiva 6 · Semgrep y Snyk (≈ 1 min 30 s)

> Semgrep y Snyk publican sus alertas en *Code scanning* de GitHub. En la captura se ve el filtro por herramienta. No las escondemos: **las revisamos una por una** y las clasificamos.
>
> - **Semgrep, 61 alertas.**
>   - Casi todas son el mismo aviso: usamos acciones de GitHub por etiqueta (`@v4`) en lugar de fijarlas por su hash. Es una buena práctica de cadena de suministro y la dejamos como plan.
>   - Encontró dos cosas más importantes. El descifrado AES-GCM no fijaba el largo de la etiqueta de autenticación: **lo corregimos**.
>   - Y el contenedor corre como *root*: es un riesgo aceptado, porque el volumen de Railway pertenece a *root*, y está documentado en el Dockerfile.
> - **Snyk Open Source, 27 alertas.** Son lodash, django y otras librerías **de nuestros proyectos de prueba**, que son vulnerables a propósito para probar el escáner. Es lo esperado.
> - **Snyk Code, 10 alertas.**
>   - Dos posibles XSS en enlaces: **los corregimos** codificando la URL.
>   - Las otras ocho son notas sobre secretos falsos dentro de las pruebas.
> - **Hadolint, 0 alertas**: el Dockerfile está limpio.

---

## Diapositiva 7 · 251 pruebas en 6 niveles (≈ 1 min)

> El gráfico muestra cuántas pruebas tenemos por nivel, tomadas del último CI:
> - 166 unitarias;
> - 26 de integración;
> - 23 de sistema;
> - 16 de interfaz;
> - 12 de aceptación;
> - 8 de la extensión en un VS Code real.
>
> **Todas en verde.**
>
> A la derecha, las métricas que acompañan:
> - cobertura de líneas, 93,5 %;
> - cobertura de ramas, 77,7 %;
> - mutación, 61 %.
>
> Y no son decorativas: **son umbrales que rompen el build**. Si la cobertura baja de 80 %, o la mutación de 50 %, el pipeline falla.

---

## Diapositiva 8 · ¿Dónde están las pruebas? (≈ 1 min 30 s)

> Esta diapositiva responde dónde está cada prueba, cómo se corre y con qué se configura. Vamos fila por fila.
>
> - **Unitarias:** en `packages/core/test`, 14 archivos. Los más grandes son los comparadores de versiones: 34 pruebas de semver y 19 de PEP 440. Se suman 17 de la lógica de la extensión, en `apps/vscode/test/unit`. Se corren con `npm run test:unit`.
> - **Integración:** en `apps/api/test`, tres archivos. El último, `no-funcionales.test.ts`, prueba sesiones, logs y telemetría.
> - **Mutación:** no tiene pruebas propias. Muta el código de `packages/core/src` y reutiliza las unitarias; se configura en `stryker.config.mjs`.
> - **Sistema:** en `tests/sistema`.
> - **Interfaz:** en `tests/ui/escaneo.spec.ts`.
> - **Aceptación:** los `.feature` en `tests/aceptacion/features` y los pasos en `steps/pasos.ts`.
> - **Extensión:** en `apps/vscode/test/e2e`.
>
> **La última fila es la clave para que sean confiables.** `tests/support/servidor-pruebas.mjs` levanta DepScan completo, pero con OSV simulado, y `tests/fixtures` tiene tres proyectos de ejemplo. Así **las pruebas no dependen de internet** ni cambian cuando se publica un aviso nuevo.

---

## Diapositiva 9 · Unitarias y mutación (≈ 1 min 30 s)

> Las unitarias prueban la lógica pura: comparar versiones, leer lockfiles, calcular CVSS, deduplicar y calcular la versión segura.
>
> Ahora, **¿cómo sabemos que esas pruebas son buenas?** Ahí entra la **mutación** con Stryker:
> - Stryker cambia el código a propósito. Por ejemplo, cambia un "menor que" por "menor o igual", o un "y" por un "o".
> - Luego vuelve a correr las pruebas.
> - Si alguna falla, el **mutante muere**: la prueba detectó el cambio. Si ninguna falla, el mutante **sobrevive**: esa línea se ejecuta, pero nadie verifica su resultado.
>
> **Tenemos 93 % de cobertura, pero 61 % de mutación.** Esa diferencia es la lección: **ejecutar una línea no es lo mismo que probarla**.
>
> La tabla muestra el puntaje por carpeta. Los comparadores de versiones están mejor, con 68 %, y el *resolver* es lo más débil, con 42 %. El reporte de `/mutacion` nos dice exactamente qué condición falta probar.

---

## Diapositiva 10 · Integración y sistema (≈ 1 min 15 s)

> **Integración, 26 pruebas.**
> - Juntamos piezas reales: la API con SQLite, las sesiones y el login de GitHub.
> - Probamos los **clientes HTTP reales** de OSV contra un OSV falso que levantamos en la prueba. Así verificamos que todas las dependencias van en **un solo lote**, que la **caché** evita repetir consultas y que, si OSV responde 503, **se reintenta**.
>
> **Sistema, 23 pruebas.** Aquí DepScan corre **compilado, como proceso aparte**, igual que en producción, y solo se le habla por HTTP. Verificamos:
> - el flujo completo: escanear, ver la solución, revisar el historial, descargar HTML y PDF, y borrar;
> - que el **historial sobrevive a reiniciar el servidor**;
> - que el límite de escaneos por IP responde 429;
> - las cabeceras de seguridad, el ID de cada petición en el log y la CLI.

---

## Diapositiva 11 · Interfaz de usuario (≈ 1 min)

> Las pruebas de interfaz usan **Playwright** con un navegador real. Corren cada prueba dos veces: en Chrome de escritorio y emulando un celular Pixel 7.
>
> Recorren lo que haría un usuario: subir los manifiestos, ver los hallazgos, abrir la solución, filtrar, descargar, borrar del historial y abrir la página de Estado.
>
> La captura es el reporte de una prueba: cada paso que hizo el navegador, con su tiempo, en verde. Además, **cada prueba graba un video y una traza** que se ven desde el reporte, en `/ui` del panel.

---

## Diapositiva 12 · Aceptación de usuario, BDD (≈ 1 min 15 s)

> Para las pruebas de aceptación usamos **BDD**: los escenarios se escriben en **Gherkin y en español**, con Dado, Cuando y Entonces. Lo que ven a la izquierda **es el archivo real**, `cu01-revisar-proyecto.feature`.
>
> Cada *feature* corresponde a un **caso de uso del FD03**: CU-01, CU-04, CU-05 y CU-08, más uno de telemetría. Es decir, **los criterios de aceptación del documento son ahora pruebas ejecutables**.
>
> El "Esquema del escenario" con su tabla de ejemplos corre la misma historia con tres proyectos distintos: dos deben salir en rojo y uno en verde.
>
> A la derecha está el reporte Cucumber: los 12 escenarios pasan. En el de historial se ve cómo probamos que **otra persona no ve mi historial**.

---

## Diapositiva 13 · Aspectos no funcionales (≈ 1 min 30 s)

> Nos pidieron evaluar cinco aspectos no funcionales. La tabla tiene, para cada uno, cómo lo hace DepScan, en qué código está y qué prueba lo demuestra.
>
> - **Sesiones.** Usamos una cookie que JavaScript no puede leer (*HttpOnly*) y que dura 30 días. En la base de datos **no guardamos la cookie, sino su hash**, y los tokens de GitHub van cifrados.
> - **Historial.** Cada escaneo tiene dueño: una sesión anónima o un usuario. Solo el dueño lo ve y lo borra, y **sobrevive a un reinicio**.
> - **Caché.** Está en SQLite con vencimiento: 24 horas para OSV y una hora para los registros. Se prueba que el segundo escaneo no vuelve a consultar OSV.
> - **Logs.** Son JSON estructurados. Cada petición tiene un **ID de correlación**, y probamos que **las cookies nunca aparecen en el log**.
> - **Telemetría.** Se las muestro en las siguientes diapositivas.

---

## Diapositiva 14 · Telemetría: la página Estado (≈ 1 min)

> La telemetría se ve **dentro de la aplicación**, en el menú **Estado**, y se actualiza cada cinco segundos.
>
> Arriba están las cifras clave: peticiones atendidas, **latencia p95** (el 95 % de las peticiones responde en menos de ese tiempo), porcentaje de errores del servidor y escaneos realizados.
>
> Al centro, **gráficos por minuto de la última hora**: peticiones con su latencia, y escaneos. Abajo, sesiones vigentes, historial, caché, escaneos por semáforo y las rutas más usadas.
>
> Todo sale de un endpoint, `/api/metrics`. Existe también `/metrics` en formato **Prometheus**, el estándar de la industria, por si se quiere conectar a Grafana.

---

## Diapositiva 15 · Telemetría: evidencia estadística (≈ 1 min)

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

## Diapositiva 16 · Cómo se generaron los datos (≈ 1 min 15 s)

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

## Diapositiva 17 · Reto: DepScan dentro del editor (≈ 1 min)

> Para el reto elegimos la segunda opción: **un plugin de VS Code con skills y agente**.
>
> La captura es real, con datos reales de OSV. Al abrir un proyecto:
> - DepScan **subraya** las librerías vulnerables en el `package.json`;
> - al pasar el mouse, muestra cada CVE con su severidad, su CVSS, el enlace a OSV y **la versión segura verificada**, con el comando para actualizar;
> - abajo, la barra de estado dice "DepScan: 3 vulnerables", en rojo.
>
> Lo importante es que **usa el mismo motor** que la web y la CLI. No reescribimos la lógica: la extensión es un adaptador de entrada más de nuestra arquitectura hexagonal.

---

## Diapositiva 18 · Quick Fix, panel, skills y agente (≈ 1 min 30 s)

> - **Quick Fix.** Con `Ctrl+.` aparece "actualizar a la versión segura verificada" y con un clic se cambia la versión en el archivo.
> - **Panel lateral.** Lista los hallazgos por severidad; al hacer clic en un CVE se abre su página en OSV.
> - **Skills.** Registramos tres herramientas que puede usar la IA del editor: escanear, explicar una vulnerabilidad y aplicar la corrección. Esta última **siempre pide confirmación** al usuario.
> - **Agente `@depscan`.** Está en el chat de VS Code y tiene tres comandos:
>   - `/scan` prioriza los riesgos;
>   - `/fix` muestra botones para corregir;
>   - `/explain` explica un CVE en lenguaje simple.
>
>   Si le hacen una pregunta libre, el agente **decide solo qué skill usar** en un bucle de llamadas. Por eso responde con datos reales y no inventa CVE.
>
> Y como extra, la misma lógica está como **skill de Claude Code**, en la carpeta `.claude/skills`.

---

## Diapositiva 19 · Cómo se hizo, cómo se descarga y cómo vive en git (≈ 1 min 30 s)

> **Cómo se hizo.**
> - La extensión es una carpeta más del monorepo, `apps/vscode`.
> - `esbuild` empaqueta el motor dentro de la extensión, así que el archivo final pesa solo 40 KB y no necesita instalar nada más.
> - Tiene 17 pruebas unitarias y **8 pruebas que abren un VS Code de verdad** y verifican el subrayado, el Quick Fix, el reescaneo y las skills.
>
> **Cómo se descarga e instala.**
> - En el panel, en `/extension`, está el botón **Descargar depscan.vsix** (es la página de abajo).
> - Se instala con `code --install-extension depscan.vsix`, o desde VS Code con "Instalar desde VSIX".
>
> **Cómo vive en git.** En `pruebas.yml` hay un job dedicado a la extensión que, en cada push:
> 1. abre VS Code en una pantalla virtual;
> 2. corre las 8 pruebas;
> 3. empaqueta la extensión;
> 4. la publica para descargar.
>
> La documentación está en `docs/RETO_VSCODE.md`.

---

## Diapositiva 20 · Cierre (≈ 30 s)

> Para cerrar: **todo lo que mostramos es verificable**.
> - 251 pruebas y 0 fallidas;
> - el Quality Gate aprobado, con 0 bugs y 0 vulnerabilidades;
> - telemetría en vivo y un plugin descargable.
>
> Todo se regenera en cada push y está en este enlace. Muchas gracias. ¿Preguntas?

---

# Preguntas probables y cómo responderlas

**"¿Por qué la mutación da 61 % si la cobertura es 93 %?"**
> Porque miden cosas distintas. La cobertura dice qué líneas se **ejecutan**; la mutación dice si las pruebas **detectan un cambio** en esas líneas. El 61 % supera nuestro umbral de 50 %, y el reporte de Stryker nos dice exactamente qué condiciones reforzar. La carpeta *resolver* es la siguiente.

**"¿Por qué hay 98 alertas abiertas en Code scanning?"**
> Porque las revisamos y no las ocultamos. 27 son de los proyectos de prueba, que son vulnerables a propósito. Unas 55 son el mismo aviso de Semgrep sobre fijar las acciones por hash, una mejora planificada. Las que eran fallas reales (GCM y los dos enlaces) ya están corregidas.

**"¿Las pruebas dependen de OSV? ¿Qué pasa si OSV se cae?"**
> Las de sistema, interfaz y aceptación usan un OSV simulado (`tests/support`), así que son reproducibles. Las de integración usan los **clientes HTTP reales** contra un servidor local, e incluso prueban qué pasa si OSV responde 503: se reintenta.

**"¿La telemetría expone datos personales?"**
> No. Son contadores agregados: peticiones, latencias, escaneos y sesiones. No incluyen nombres, correos ni proyectos. El log registra el dueño solo como "anon" o "user". En producción se puede proteger con `METRICS_TOKEN`.

**"¿Cómo se generaron los gráficos de telemetría?"**
> Con `scripts/telemetria-demo.mjs`: levanta DepScan, simula 6 minutos de uso y guarda las lecturas de `/api/metrics` cada 10 s en `datos/telemetria-demo.json`. Luego `graficos.mjs` dibuja desde ese JSON. Se repite con `npm run build && node scripts/telemetria-demo.mjs 6`. La página **Estado** dibuja los mismos datos en vivo.

**"¿El agente @depscan funciona sin Copilot?"**
> `/scan` y `/fix` sí, porque no necesitan un modelo de IA. Las preguntas libres usan el modelo del chat de VS Code, normalmente Copilot. Las skills están probadas en las pruebas e2e llamándolas directamente.
