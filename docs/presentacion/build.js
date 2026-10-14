// Incrusta las capturas (img/*.jpg) en fuente.html y genera DepScan-Presentacion.html autocontenido.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, "fuente.html"), "utf8").replace(/\{\{IMG:(\w+)\}\}/g, (_, n) => {
  const b64 = readFileSync(join(dir, "img", `${n}.jpg`)).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
});
writeFileSync(join(dir, "DepScan-Presentacion.html"), html);
console.log("DepScan-Presentacion.html generado");
