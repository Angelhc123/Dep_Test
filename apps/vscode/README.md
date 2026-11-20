# DepScan para VS Code

Detecta **librerías vulnerables** de npm y PyPI mientras programas. Para cada una propone la **versión segura verificada**, que es la menor versión publicada sin ninguna falla conocida, y trae el agente **`@depscan`** para el chat del editor.

Es el mismo motor de DepScan que usan la web y la CLI: lee `package.json`, `package-lock.json` y `requirements.txt` y consulta las bases públicas **OSV** (Google) y los registros de npm y PyPI.

## Qué hace

| Función | Cómo se ve |
|---|---|
| **Subrayado en el manifiesto** | Las dependencias vulnerables aparecen subrayadas en rojo (crítica/alta), amarillo (media) o azul (baja), con el CVE y la solución. |
| **Hover** | Al pasar el mouse muestra cada vulnerabilidad con su severidad, CVSS y enlace a OSV, la versión en que se corrigió y los comandos para actualizar. |
| **Quick Fix 💡** | *"DepScan: actualizar lodash a 4.17.21 (versión segura verificada)"*. En `package.json` conserva el `^`/`~`; en `requirements.txt` fija `==`. |
| **Panel lateral** | Árbol de hallazgos ordenado por severidad, con las vulnerabilidades de cada librería. |
| **Barra de estado** | `🛡 DepScan: 2 vulnerables`, en rojo si el riesgo es alto. |
| **Reporte** | *DepScan: Ver reporte completo* abre el mismo reporte HTML que genera la web. |
| **Reescaneo automático** | Al guardar un manifiesto (configurable). La caché en disco evita volver a descargar avisos de OSV. |

## Skills para la IA del editor

La extensión registra tres **herramientas** (*Language Model Tools*). Cualquier agente del editor puede usarlas: Copilot en modo agente, o `@depscan`.

| Skill | Para qué |
|---|---|
| `#depscanScan` | Escanea el proyecto y devuelve en JSON los hallazgos con severidad, CVE y versión segura. |
| `#depscanVulnerability` | Detalle de un CVE o GHSA: qué es, a qué afecta en tu proyecto y mitigaciones. |
| `#depscanFix` | Actualiza una dependencia directa a su versión segura. **Siempre pide confirmación.** |

## Agente `@depscan`

En el chat de VS Code:

- `@depscan /scan`: escanea y prioriza qué corregir primero.
- `@depscan /fix`: muestra botones para aplicar cada actualización segura.
- `@depscan /explain CVE-2021-23337`: explica la falla en lenguaje sencillo.
- `@depscan ¿es seguro mi proyecto? arregla lo crítico`: el agente decide qué skills usar, en un bucle de *tool calling*, y responde con datos reales, sin inventar CVE.

`/scan` y `/fix` funcionan aunque no haya un modelo de IA disponible. Las preguntas libres usan el modelo que tengas activo en el chat.

## Comandos

- `DepScan: Escanear dependencias del proyecto`
- `DepScan: Ver reporte completo`
- `DepScan: Actualizar todas las dependencias directas a su versión segura`
- `DepScan: Limpiar caché de vulnerabilidades`

## Configuración

| Ajuste | Por defecto | Qué hace |
|---|---|---|
| `depscan.scanOnSave` | `true` | Reescanea al guardar un manifiesto. |
| `depscan.includeDev` | `true` | Incluye `devDependencies`. |
| `depscan.estimate` | `true` | Sin lockfile, estima la versión instalada consultando el registro. |
| `depscan.minimumSeverity` | `low` | Severidad mínima que se subraya. |

## Instalar desde el `.vsix`

```bash
code --install-extension depscan.vsix
```

También se puede desde VS Code: *Extensiones → ⋯ → Instalar desde VSIX…*.

---

Proyecto DepScan, UPT/EPIS: Angel Gadiel Hernández Cruz, Richard Alexis Podestá Condori y Gustavo Alonso Sagua Ramos.
