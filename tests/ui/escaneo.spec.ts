// PRUEBAS DE INTERFAZ: el usuario sube los manifiestos de un proyecto desde el
// navegador, ve el semáforo, la tabla de hallazgos y la solución propuesta.
import { expect, test, type Page } from "@playwright/test";

const DEMO = "tests/fixtures/proyecto-demo";

async function escanearDemo(page: Page, nombre: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nuevo escaneo" })).toBeVisible();
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles([`${DEMO}/package.json`, `${DEMO}/package-lock.json`, `${DEMO}/requirements.txt`]);
  await expect(page.getByRole("list").getByText("package-lock.json")).toBeVisible();
  await page.getByLabel("Nombre del proyecto (opcional)").fill(nombre);
  await page.getByRole("button", { name: "Escanear", exact: true }).click();
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
}

test.describe("Nuevo escaneo", () => {
  test("el botón Escanear está deshabilitado hasta elegir archivos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Escanear", exact: true })).toBeDisabled();
  });

  test("subir manifiestos muestra el resultado con 2 dependencias vulnerables", async ({ page }) => {
    await escanearDemo(page, "demo-ui");
    await expect(page).toHaveURL(/#\/scan\//);
    await expect(page.getByText("2 / 3")).toBeVisible();
    await expect(page.getByText("Dependencias vulnerables")).toBeVisible();
    const tabla = page.getByRole("table").last();
    await expect(tabla.getByText("lodash", { exact: true })).toBeVisible();
    await expect(tabla.getByText("django", { exact: true })).toBeVisible();
  });

  test("Ver solución abre el panel con la versión segura verificada", async ({ page }) => {
    await escanearDemo(page, "demo-solucion");
    const fila = page.getByRole("row").filter({ hasText: "lodash" });
    await fila.getByRole("button", { name: "Ver solución" }).click();
    const panel = page.getByRole("complementary", { name: "Solución para lodash" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Cómo resolverlo")).toBeVisible();
    await expect(panel.getByText("4.17.21").first()).toBeVisible();
    await panel.getByRole("button", { name: "Cerrar" }).click();
    await expect(panel).toBeHidden();
  });

  test("el buscador filtra la tabla de hallazgos", async ({ page }) => {
    await escanearDemo(page, "demo-filtro");
    await page.getByPlaceholder("Buscar paquete o CVE…").fill("django");
    const tabla = page.getByRole("table").last();
    await expect(tabla.getByText("django", { exact: true })).toBeVisible();
    await expect(tabla.getByText("lodash", { exact: true })).toBeHidden();
  });

  test("los enlaces de descarga apuntan al reporte HTML y PDF", async ({ page }) => {
    await escanearDemo(page, "demo-descargas");
    await expect(page.getByRole("link", { name: "Descargar PDF" })).toHaveAttribute("href", /report\.pdf$/);
    const descarga = page.waitForEvent("download");
    await page.getByRole("link", { name: "Descargar HTML" }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^depscan-demo-descargas-.*\.html$/);
  });
});

test.describe("Historial", () => {
  test("los escaneos de la sesión aparecen en el historial y se eliminan con confirmación", async ({
    page,
  }) => {
    await escanearDemo(page, "demo-historial");
    await page.getByRole("link", { name: "Historial" }).click();
    await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
    const fila = page.getByRole("row").filter({ hasText: "demo-historial" });
    await expect(fila).toBeVisible();
    // Borrar pide confirmación: el primer clic muestra "Eliminar / Cancelar".
    await fila.getByRole("button", { name: "Eliminar" }).click();
    await expect(fila.getByRole("button", { name: "Cancelar" })).toBeVisible();
    await fila.getByRole("button", { name: "Eliminar" }).click();
    await expect(fila).toBeHidden();
  });
});

test.describe("Navegación", () => {
  test("la página Cómo funciona se abre desde el menú", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Cómo funciona" }).click();
    await expect(page).toHaveURL(/#\/about/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Estado (telemetría)", () => {
  test("la página Estado refleja un escaneo nuevo en la telemetría", async ({ page }) => {
    await page.goto("/#/estado");
    await expect(page.getByRole("heading", { name: "Estado del sistema" })).toBeVisible();
    const tarjeta = page.getByText("Escaneos desde el arranque").locator("..");
    const antes = Number(await tarjeta.locator("div").first().innerText());

    await escanearDemo(page, "demo-telemetria");
    await page.getByRole("link", { name: "Estado" }).click();
    await expect(tarjeta.locator("div").first()).toHaveText(String(antes + 1));
    await expect(page.getByText("Sesiones vigentes")).toBeVisible();
    await expect(page.getByRole("cell", { name: "POST /api/scans" })).toBeVisible();
  });
});
