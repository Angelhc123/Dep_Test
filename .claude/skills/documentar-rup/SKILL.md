---
name: documentar-rup
description: Redacta o actualiza los documentos RUP de la UPT/EPIS (FD01 Factibilidad, FD02 Visión, FD03 Especificación de Requerimientos, FD04 Arquitectura, FD05 Informe Final, FD06 Propuesta) en docs/RUP para el proyecto depscan, con lenguaje académico, tablas y diagramas Mermaid.
---

# Documentación RUP (formato EPIS – UPT)

Los documentos viven en `docs/RUP/FDxx-EPIS-*.md`. Las plantillas traen carátula, índice y títulos.

## Reglas de forma
- **Conservar** la carátula, el índice y **todos** los títulos de la plantilla, con el mismo texto y orden. Solo se agrega contenido debajo (y subtítulos de nivel inferior si hace falta).
- Reemplazar `{Nombre del Proyecto}` por: **DepScan: Sistema Web de Detección y Remediación de Dependencias Vulnerables**.
- Autor: Angel Gadiel Hernandez Cruz · Tacna – Perú · 2026. Docente/curso: dejar el dato que indique el usuario; si no lo hay, no inventarlo.
- Español formal, tercera persona, impersonal ("se propone", "el sistema permite"). Sin emojis.
- Tablas en Markdown para todo dato comparable (costos, riesgos, requerimientos, actores).
- Diagramas **solo** en bloques ```mermaid (flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram-v2, gantt, pie, C4/flowchart por capas). Cada diagrama lleva un título en negrita y una frase que lo explique.
- Montos en soles (S/), tipo de cambio declarado (US$ 1 = S/ 3.75). Toda cifra estimada se declara como estimación y con su supuesto.
- No contradecir el código: datos técnicos se toman de `docs/ARQUITECTURA.md`, `docs/decisiones/`, `docs/informe/` y del código en `packages/`, `apps/`.

## Tono por documento
| Documento | Lenguaje | Contenido clave |
|---|---|---|
| FD01 Factibilidad | Gestión / evaluación | Riesgos con probabilidad e impacto, factibilidades (técnica, económica con **tablas de costos**, operativa, legal, social, ambiental), análisis financiero (flujo de caja, VAN, TIR, B/C, recuperación). |
| FD02 Visión | Negocio, argumentativo | Problema, oportunidad, interesados, **alcance completo, limitaciones, restricciones**, capacidades, costos/precios, licenciamiento, estándares. |
| FD03 Requerimientos | **Lenguaje humano, no técnico**: qué hará el sistema contado para un usuario o docente | RF/RNF en tablas, reglas de negocio, perfiles, **diagramas de casos de uso**, actividades y especificación de casos de uso. Evitar nombres de clases, librerías o endpoints. |
| FD04 Arquitectura | **Técnico** | Objetivos y restricciones, vista lógica (capas, componentes, clases, modelo de datos), vista de despliegue (Railway, contenedor, volumen), secuencias, **patrones** (hexagonal, puertos y adaptadores, repositorio, estrategia, fachada, pipeline) y decisiones (ADR). |
| FD05 Informe Final | Académico de cierre | Resultados medidos (pruebas, benchmark, despliegue), cronograma real, presupuesto ejecutado. |
| FD06 Propuesta | Ejecutivo y persuasivo | Resumen, justificación, objetivos SMART, beneficios, alcance, cronograma y presupuesto. |

## Coherencia entre documentos
- Mismos IDs en todos los documentos: RF-xx, RNF-xx, RN-xx, CU-xx, R-xx (riesgos).
- Las cifras de costos de FD01, FD02 (4.4), FD05 y FD06 deben ser las mismas.
- Cronograma por fases RUP: Inicio, Elaboración, Construcción, Transición.

## Verificación
Al terminar, revisar que cada título de la plantilla tenga contenido y que cada bloque mermaid abra y cierre.

## Generación de los .docx
- Formato oficial: `docs/RUP/plantilla.js` (APA 7: Calibri 11, carátula con logo, portada interna, control de versiones, índice automático, tablas APA con "Tabla N" y título en cursiva, figuras "Figura N", nota "Elaboración propia", bibliografía con sangría francesa, encabezado con número de página y pie con sigla).
- Cada `fdXX.js` sigue esa plantilla y contiene el texto del documento (`h1/h2/h3`, `parrafo`, `vinetas`, `numerada`, `tablaAPA`, `tablaAtributos`, `figuraAPA`, `ref`). Si se cambia un `.md`, se actualiza también su `fdXX.js`.
- Los diagramas Mermaid se insertan como imágenes `docs/RUP/img/fdXX-NN.png` (NN = orden del diagrama en el .md).
- Generar: `cd docs/RUP && npm install && npm run docs` (o `node fdXX.js`). Los `fdXX.js` ya no escriben el `.md`.
- Al abrir el .docx, Word pregunta si actualizar los campos: responder "Sí" para numerar el índice.
