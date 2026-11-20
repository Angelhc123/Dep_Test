---
name: revisar-dependencias
description: Revisa si las dependencias de un proyecto (package.json, package-lock.json, requirements.txt) tienen vulnerabilidades conocidas usando el motor de DepScan, prioriza los riesgos y aplica las versiones seguras verificadas. Úsala cuando el usuario pregunte si su proyecto es seguro, mencione un CVE/GHSA de una librería, o pida actualizar dependencias vulnerables.
---

# Revisar dependencias con DepScan

Esta skill usa la CLI de DepScan, que tiene el mismo motor que la web y que la extensión de VS Code. Con ella detecta librerías vulnerables de npm y PyPI y calcula la **versión segura verificada**: la menor versión publicada sin **ninguna** falla conocida.

## 1. Escanear

Desde la raíz del repositorio de DepScan:

```bash
npm run build                       # una vez (compila la CLI)
node apps/cli/dist/index.js <carpeta-del-proyecto> --format json --output depscan.json
```

- `--no-dev` excluye las devDependencies.
- `--estimate` estima versiones cuando no hay lockfile.
- Sin `--output`, `--format table` imprime un resumen legible.
- El código de salida es distinto de 0 si se supera `--fail-on` (por defecto, `critical`).

Lee `depscan.json`: `summary`, para el semáforo y los conteos, y `findings[]`. Cada hallazgo trae:

| Campo | Contenido |
|---|---|
| `dependency` | `name`, `resolved`, `direct`, `path` (la cadena si es transitiva) y `sourceFile` |
| `vulnerabilities[]` | `id`, `severity`, `cvss`, `summary` y `fixedIn` |
| `remediation` | `status` (`upgrade` / `no-fix` / `unknown`), `recommended`, `verified`, `commands[]`, `snippet` (overrides) y `mitigations[]` |

## 2. Explicar y priorizar

Ordena por severidad: crítica > alta > media > baja. Dentro de cada nivel, pon primero las dependencias **directas** y las que no son `dev`.

Para cada hallazgo explica en español y en pocas líneas:
- qué es la falla;
- si la versión segura cambia la versión mayor (`majorBump`);
- el comando concreto de `remediation.commands`.

**No inventes CVE ni versiones:** usa solo lo que trae el JSON. Si hace falta más detalle de un aviso, consulta `https://api.osv.dev/v1/vulns/<ID>`.

## 3. Corregir (solo si el usuario lo pide)

- **Directa npm:** en `package.json` cambia la versión a `remediation.recommended` y conserva el prefijo `^` o `~`. Luego ejecuta `npm install`.
- **Directa PyPI:** en `requirements.txt` escribe `paquete==<recommended>`, conservando el marcador `; …` y los comentarios. Luego ejecuta `pip install -r requirements.txt`.
- **Transitiva:**
  - si `fixableByLockfileUpdate` es true, basta con `npm update <paquete>`;
  - si no, propone el `remediation.snippet` (`overrides` de npm) o actualizar el paquete padre (`dependency.path[0]`).
- **`no-fix`:** no hay versión segura publicada. Explica las `mitigations` y recomienda un reemplazo si es razonable.

Después de corregir, **vuelve a escanear** y muestra la comparación antes/después (vulnerables y semáforo).
