# ADR-011: Remediación (versiones seguras, comandos y mitigaciones)

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

No basta con decir "está vulnerable". Se pidió recomendar a qué versión pasar, listar todas las versiones seguras de
la misma librería y, si se quiere seguir usándola, indicar un parche o cómo protegerse.

## Decisión

Módulo propio `packages/core/src/analysis/remediation.ts`:

1. **Versiones seguras verificadas.** Se piden todos los avisos del paquete (`OSV /v1/query` sin versión) y todas las
   versiones publicadas (registro npm/PyPI). Cada versión estable se evalúa contra **todos** los avisos, no solo los
   de la versión actual: una versión "corregida" para una falla puede tener otra.
2. **Recomendada** = la más nueva sin fallas dentro de la misma versión mayor (sin ruptura según semver). Si no hay,
   la mínima segura, marcada como "salto mayor". Además se muestran la mínima y la más nueva.
3. **Cómo aplicarlo**:
   - npm directa: `npm install pkg@x`.
   - npm transitiva: si el rango del padre ya admite una versión segura, basta con `npm update pkg`. Si no, se da un
     fragmento `overrides` para `package.json` o se sugiere actualizar la dependencia directa que la trae.
   - PyPI: `pip install "pkg==x"` y la línea para `requirements.txt`.
4. **Si se sigue usando la versión vulnerable**: la sección _Workarounds_ del aviso original, una guía por tipo de
   falla (CWE: prototype pollution, ReDoS, XSS, path traversal, SSRF…) y los commits de la corrección (para
   `patch-package` o un fork).

## Consecuencias

- Un proyecto con N paquetes vulnerables hace N consultas extra a OSV y N al registro, con concurrencia de 6 y caché.
  NodeGoat (133 paquetes vulnerables): unos 18 s la primera vez.
- "Seguro" significa "sin avisos conocidos hoy". El reporte lo declara.
- Se desactiva con `options.remediation: false` (API) o `--no-remediation` (CLI).
