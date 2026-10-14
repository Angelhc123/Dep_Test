# Benchmark preliminar: 2026-10-13

- Herramientas: depscan 0.1.0 · npm 11.11.0 (`npm audit --package-lock-only`) · osv-scanner **no instalado**.
- Repos y commits: `benchmark/repos.json`. Datos completos: `benchmark/results/2026-10-13/`.
- Unidad: (paquete, aviso). Dos hallazgos coinciden si es el mismo paquete y comparten algún ID o alias.
- Las bases cambian a diario: estos números valen solo para esta fecha.

| Repo                   | Commit     | Deps | Sin versión | depscan | npm audit | Común | Solo depscan | Solo audit |
| ---------------------- | ---------- | ---- | ----------- | ------- | --------- | ----- | ------------ | ---------- |
| OWASP/NodeGoat         | `c5cb68a7` | 1091 | 0           | 193     | 197       | 193   | 0            | 0          |
| snyk-labs/nodejs-goof  | `add14ba5` | 980  | 0           | 228     | 232       | 228   | 0            | 0          |
| cr0hn/vulnerable-node  | `d68f2a3c` | 124  | 0           | 5       | 5         | 5     | 0            | 0          |
| adeyosemanputra/pygoat | `19d17cc8` | 46   | 0           | 147     | —         | —     | —            | —          |
| anxolerd/dvpwa         | `a1d8f89f` | 18   | 0           | 55      | —         | —     | —            | —          |
| fportantier/vulpy      | `5249cc8b` | 9    | 9           | 0       | —         | —     | —            | —          |

## Lectura

- **npm**: en los 3 repos no hay hallazgos que encuentre solo una de las dos herramientas.
  - La diferencia de 4 avisos en NodeGoat y nodejs-goof viene de la **deduplicación**: npm audit lista por separado avisos GHSA
    que comparten el mismo CVE, y depscan los une en un solo hallazgo (ninguno queda sin cubrir).
  - Esto se debe confirmar a mano en la revisión.
- **PyPI**: no hay comparación todavía. Falta instalar `osv-scanner` y volver a correr `npm run benchmark`.
- **vulpy**: las 9 dependencias no tienen versión fija ni lockfile, así que depscan no puede verificarlas y lo declara
  ("sin versión determinable") en vez de inventar resultados. Con `--estimate` se puede obtener una estimación marcada como tal.

## Pendiente

1. Instalar `osv-scanner` y repetir la corrida para tener la tercera columna, sobre todo para PyPI.
2. Revisar a mano una muestra de las diferencias, leyendo el aviso original, y clasificar aciertos y falsos positivos.
3. Agregar 2 o 3 repos "reales" (no vulnerables a propósito) para medir en condiciones normales.
