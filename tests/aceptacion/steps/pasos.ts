// Definición de pasos de las pruebas de aceptación (Gherkin en español).
// Cada paso traduce una frase del usuario a acciones reales en el navegador.
import { readFileSync, readdirSync } from "node:fs";
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

const FIXTURES = "tests/fixtures";
const archivosDe = (proyecto: string) =>
  readdirSync(`${FIXTURES}/${proyecto}`).map((f) => `${FIXTURES}/${proyecto}/${f}`);

Given("que estoy en la página {string}", async ({ page }, titulo: string) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
});

When("subo los archivos del proyecto {string}", async ({ page }, proyecto: string) => {
  await page.locator('input[type="file"][multiple]').setInputFiles(archivosDe(proyecto));
  await page.getByLabel("Nombre del proyecto (opcional)").fill(proyecto);
});

When("presiono {string}", async ({ page }, boton: string) => {
  await page.getByRole("button", { name: boton, exact: true }).click();
});

Given("que escaneé el proyecto {string}", async ({ page }, proyecto: string) => {
  await page.goto("/");
  await page.locator('input[type="file"][multiple]').setInputFiles(archivosDe(proyecto));
  await page.getByLabel("Nombre del proyecto (opcional)").fill(proyecto);
  await page.getByRole("button", { name: "Escanear", exact: true }).click();
  await expect(page.getByRole("heading", { name: proyecto })).toBeVisible();
});

Then("veo el semáforo {string}", async ({ page }, etiqueta: string) => {
  await expect(page.getByText(etiqueta, { exact: true }).first()).toBeVisible();
});

Then("veo {string} dependencias vulnerables", async ({ page }, valor: string) => {
  const tarjeta = page.getByText("Dependencias vulnerables").locator("..");
  await expect(tarjeta).toContainText(valor);
});

Then("el botón {string} está deshabilitado", async ({ page }, boton: string) => {
  await expect(page.getByRole("button", { name: boton, exact: true })).toBeDisabled();
});

When("abro la solución de {string}", async ({ page }, libreria: string) => {
  const fila = page.getByRole("row").filter({ has: page.getByText(libreria, { exact: true }) });
  await fila.getByRole("button", { name: "Ver solución" }).click();
  await expect(page.getByRole("complementary", { name: `Solución para ${libreria}` })).toBeVisible();
});

Then("se recomienda actualizar a {string}", async ({ page }, version: string) => {
  const panel = page.getByRole("complementary", { name: /Solución para/ });
  await expect(panel).toContainText("Recomendado:");
  await expect(panel).toContainText(version);
});

When("descargo el informe {string}", async ({ page, $testInfo }, formato: string) => {
  const descarga = page.waitForEvent("download");
  await page.getByRole("link", { name: `Descargar ${formato}` }).click();
  const archivo = await descarga;
  const ruta = $testInfo.outputPath(archivo.suggestedFilename());
  await archivo.saveAs(ruta);
  $testInfo.annotations.push({ type: "archivo", description: ruta });
});

const ultimoArchivo = (anotaciones: { type: string; description?: string }[]) =>
  anotaciones.findLast((a) => a.type === "archivo")!.description!;

Then(
  "obtengo un archivo {string} que menciona {string}",
  async ({ $testInfo }, extension: string, texto: string) => {
    const ruta = ultimoArchivo($testInfo.annotations);
    expect(ruta.endsWith(extension)).toBe(true);
    expect(readFileSync(ruta, "utf8")).toContain(texto);
  },
);

Then("obtengo un archivo {string} válido", async ({ $testInfo }, extension: string) => {
  const ruta = ultimoArchivo($testInfo.annotations);
  expect(ruta.endsWith(extension)).toBe(true);
  expect(readFileSync(ruta).subarray(0, 5).toString()).toBe("%PDF-");
});

When("abro el {string}", async ({ page }, enlace: string) => {
  await page.getByRole("link", { name: enlace }).click();
  await expect(page.getByRole("heading", { name: enlace })).toBeVisible();
});

Then("veo la revisión {string} en la lista", async ({ page }, nombre: string) => {
  await expect(page.getByRole("row").filter({ hasText: nombre }).first()).toBeVisible();
});

When(
  "otra persona abre el {string} en su navegador",
  async ({ browser, $testInfo }, enlace: string) => {
    // Contexto nuevo = otro navegador, sin la cookie de sesión del primero.
    const otro = await browser.newContext({ baseURL: $testInfo.project.use.baseURL });
    const pagina = await otro.newPage();
    await pagina.goto("/");
    await pagina.getByRole("link", { name: enlace }).click();
    await expect(pagina.getByText("Aún no hay escaneos.")).toBeVisible();
    await otro.close();
    $testInfo.annotations.push({ type: "historial-ajeno", description: "vacío" });
  },
);

Then("su historial está vacío", async ({ $testInfo }) => {
  expect($testInfo.annotations.some((a) => a.type === "historial-ajeno")).toBe(true);
});

When("elimino la revisión {string} y confirmo", async ({ page }, nombre: string) => {
  const fila = page.getByRole("row").filter({ hasText: nombre }).first();
  await fila.getByRole("button", { name: "Eliminar" }).click();
  await fila.getByRole("button", { name: "Eliminar" }).click();
});

Then("ya no veo la revisión {string} en la lista", async ({ page }, nombre: string) => {
  await expect(page.getByRole("row").filter({ hasText: nombre })).toHaveCount(0);
});
