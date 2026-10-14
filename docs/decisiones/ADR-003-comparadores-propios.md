# ADR-003: Comparadores de versiones propios (semver y PEP 440)

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

Para resolver rangos sin lockfile, decidir si una versión cae en un rango afectado de OSV y calcular la versión
mínima segura hay que comparar versiones de npm (semver) y de Python (PEP 440).

## Decisión

Implementarlos en `packages/core/src/versions/`:

- `semver.ts`: SemVer 2.0.0 y los rangos de npm (`^`, `~`, x-ranges, guiones, `||`) con la regla de pre-releases de node-semver.
- `pep440.ts`: épocas, pre/post/dev, versiones locales y los especificadores `==`, `!=`, `~=`, `>=`, `<=`, `>`, `<`, `===` y `.*`.

## Alternativas descartadas

- Librería `semver` y un port de `packaging`: resuelven el problema, pero esta es una parte central de lo que se evalúa.

## Consecuencias

- El core mantiene cero dependencias de runtime.
- Las pruebas usan los casos de las especificaciones (por ejemplo, el orden canónico de PEP 440).
- Riesgo: casos borde no cubiertos. Se mitiga con el benchmark contra npm audit y osv-scanner.
