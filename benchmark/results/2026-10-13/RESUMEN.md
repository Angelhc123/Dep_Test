# Benchmark 2026-10-13

- depscan 0.1.0 · npm 11.11.0 · osv-scanner no instalado
- Fecha del escaneo: 2026-10-13T22:29:19.249Z (las bases OSV/NVD cambian a diario)
- Unidad de comparación: (paquete, aviso). Dos hallazgos coinciden si es el mismo paquete y comparten algún ID o alias.

| Repo | Commit | Deps | Sin versión | depscan | npm audit | común | solo depscan | solo audit | osv-scanner | común | solo depscan | solo osv |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OWASP/NodeGoat | `c5cb68a7` | 1091 | 0 | 193 | 197 | 193 | 0 | 0 | — | — | — | — |
| snyk-labs/nodejs-goof | `add14ba5` | 980 | 0 | 228 | 232 | 228 | 0 | 0 | — | — | — | — |
| cr0hn/vulnerable-node | `d68f2a3c` | 124 | 0 | 5 | 5 | 5 | 0 | 0 | — | — | — | — |
| adeyosemanputra/pygoat | `19d17cc8` | 46 | 0 | 147 | — | — | — | — | — | — | — | — |
| anxolerd/dvpwa | `a1d8f89f` | 18 | 0 | 55 | — | — | — | — | — | — | — | — |
| fportantier/vulpy | `5249cc8b` | 9 | 9 | 0 | — | — | — | — | — | — | — | — |

## Muestra para revisión manual

Leer el aviso original y clasificar cada diferencia como *acierto*, *falso positivo* o *diferencia de criterio*
(por ejemplo, npm audit agrupa por nombre de paquete sin versión, y sin lockfile depscan no verifica rangos).

| Repo | Paquete | IDs | Diferencia | Clasificación (manual) |
|---|---|---|---|---|
| — | — | — | Sin diferencias | |
