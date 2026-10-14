---
name: generar-docs
description: Genera o actualiza la documentación de depscan (arquitectura, ADRs, README, informe de benchmark y limitaciones). Úsala cuando cambie una decisión técnica, se agregue un módulo o se cierre una fase.
---

# Generar documentación de depscan

## Archivos

| Archivo                             | Contenido                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/ARQUITECTURA.md`              | Stack, arquitectura, estructura de carpetas, API, plan por fases. Fuente de verdad. |
| `docs/decisiones/ADR-XXX-titulo.md` | Una decisión técnica por archivo (plantilla abajo).                                 |
| `docs/DESPLIEGUE.md`                | Pasos de Railway, variables de entorno y volumen.                                   |
| `README.md`                         | Qué es, cómo instalar, cómo correr y enlaces a `docs/`.                             |
| `docs/informe/`                     | Resultados de benchmark fechados y limitaciones declaradas.                         |

## Reglas

- En español, directo, sin relleno.
- Si el código y la doc no coinciden, revisa el código y corrige la doc (el código manda).
- Los diagramas van en bloques ```mermaid.
- Cualquier número del benchmark lleva la fecha del escaneo, el commit del repo analizado y la versión de la herramienta.
- Las limitaciones (alertas no explotables, solo lo ya publicado, sin lockfile hay menos precisión, depende de internet) se mantienen siempre en el informe.

## Plantilla ADR

```markdown
# ADR-XXX: <título>

- Estado: propuesta | aceptada | reemplazada por ADR-YYY
- Fecha: AAAA-MM-DD

## Contexto

## Decisión

## Alternativas descartadas

## Consecuencias
```
