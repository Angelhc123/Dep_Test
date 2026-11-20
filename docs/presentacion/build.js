// Genera las presentaciones autocontenidas:
//   fuente.html          → DepScan-Presentacion.html  (producto)
//   fuente-calidad.html  → DepScan-Calidad.html       (calidad, pruebas, no funcionales, reto)
// Reemplaza {{IMG:nombre}} por img/nombre.(jpg|png) en base64 y {{SVG:nombre}} por
// diagramas/nombre.svg (generados con `node diagramas.mjs` y `node graficos.mjs`).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

function incrustar(html) {
  return html
    .replace(/\{\{IMG:([\w-]+)\}\}/g, (_, n) => {
      for (const [ext, mime] of [["jpg", "jpeg"], ["png", "png"]]) {
        const f = join(dir, "img", `${n}.${ext}`);
        if (existsSync(f)) return `data:image/${mime};base64,${readFileSync(f).toString("base64")}`;
      }
      throw new Error(`Falta la imagen img/${n}`);
    })
    .replace(/\{\{SVG:([\w-]+)\}\}/g, (_, n) => readFileSync(join(dir, "diagramas", `${n}.svg`), "utf8"));
}

for (const [fuente, salida] of [
  ["fuente.html", "DepScan-Presentacion.html"],
  ["fuente-calidad.html", "DepScan-Calidad.html"],
]) {
  if (!existsSync(join(dir, fuente))) continue;
  writeFileSync(join(dir, salida), incrustar(readFileSync(join(dir, fuente), "utf8")));
  console.log(`${salida} generado`);
}
