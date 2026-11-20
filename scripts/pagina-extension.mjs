// Genera site/extension/index.html: página de descarga de la extensión de VS Code.
const REPO = process.env.GITHUB_REPOSITORY ?? "Angelhc123/Dep_Test";
const GH = `https://github.com/${REPO}`;

const funciones = [
  ["Subrayado", "Las librerías vulnerables se marcan en package.json, package-lock.json y requirements.txt."],
  ["Hover", "Severidad, CVSS, enlace a OSV, versión que lo corrige y comandos para actualizar."],
  ["Quick Fix 💡", "“Actualizar a la versión segura verificada” con un clic (conserva ^ / ~)."],
  ["Panel y barra de estado", "Árbol de hallazgos por severidad y contador de vulnerables."],
  ["Skills para la IA", "#depscanScan, #depscanVulnerability y #depscanFix para Copilot en modo agente."],
  ["Agente @depscan", "/scan, /fix y /explain en el chat, o preguntas libres con tool calling."],
];

process.stdout.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DepScan para VS Code</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --tx:#1b1b1f; --mu:#62626b; --bd:#e3e3df; --ac:#2457d6; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141417; --card:#1d1d22; --tx:#ececf1; --mu:#a1a1ab; --bd:#2e2e35; --ac:#7aa2ff; } }
  body { margin:0; background:var(--bg); color:var(--tx); font:15px/1.6 system-ui,sans-serif; }
  main { max-width:860px; margin:0 auto; padding:32px 16px 64px; }
  a { color:var(--ac); } .mu { color:var(--mu); }
  .btn { display:inline-block; background:var(--ac); color:#fff; padding:10px 18px; border-radius:10px; text-decoration:none; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; margin:20px 0; }
  .card { background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:14px 16px; }
  pre { background:var(--card); border:1px solid var(--bd); border-radius:10px; padding:12px 14px; overflow-x:auto; }
</style></head><body><main>
<p><a href="../">← Panel de pruebas</a></p>
<h1>DepScan para VS Code</h1>
<p class="mu">Detecta dependencias vulnerables mientras programas y propone la versión segura verificada. Incluye skills para la IA del editor y el agente <code>@depscan</code>.</p>
<p><a class="btn" href="depscan.vsix" download>Descargar depscan.vsix</a></p>
<h2>Instalar</h2>
<pre>code --install-extension depscan.vsix</pre>
<p class="mu">O en VS Code: Extensiones → ⋯ → <em>Instalar desde VSIX…</em> (requiere VS Code 1.99 o superior).</p>
<h2>Qué hace</h2>
<div class="grid">${funciones.map(([t, d]) => `<div class="card"><strong>${t}</strong><div class="mu">${d}</div></div>`).join("")}</div>
<p>Código fuente y documentación: <a href="${GH}/tree/main/apps/vscode">apps/vscode</a> · pruebas e2e en un VS Code real en cada push.</p>
</main></body></html>
`);
