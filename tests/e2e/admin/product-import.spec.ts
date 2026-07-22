import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import ExcelJS from "@protobi/exceljs";
import { and, eq } from "drizzle-orm";
import { dbSqlite } from "@/database/drizzle/db";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import { zentroStandardXlsxImporter } from "@/features/product-imports/zentro-standard-xlsx.server";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";

function asArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function buildProductFile(productName: string) {
  const template = await zentroStandardXlsxImporter.template?.build();
  if (!template) {
    throw new Error("Missing product import template");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(asArrayBuffer(template));
  const sheet = workbook.getWorksheet("Productos");
  if (!sheet) {
    throw new Error("Missing Productos sheet");
  }
  sheet.getRow(2).values = [
    productName,
    "Importados E2E",
    `E2E-${Date.now()}`,
    "",
    9900,
    3000,
    0,
    7,
    2,
    5,
    "SI",
    "NO",
    "NO",
    "revenue",
    "NO",
    "cash",
  ];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe("platform product imports", () => {
  test("previews and commits a standard XLSX import", async ({ page }) => {
    const bootstrap = await createIsolatedE2EAccount(page.request);
    const db = dbSqlite();
    const [adminUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, bootstrap.loginEmail))
      .limit(1);
    const [targetOrganization] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, bootstrap.orgName))
      .limit(1);
    if (!(adminUser && targetOrganization)) {
      throw new Error("Could not resolve the isolated admin fixture");
    }
    const emptyOrganizationName = `Sin importaciones ${Date.now()}`;
    await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: emptyOrganizationName,
      slug: `sin-importaciones-${Date.now()}`,
      createdAt: new Date(),
    });
    const forbiddenImporters = await page.request.get(
      "/api/admin/product-imports/importers"
    );
    expect(forbiddenImporters.status()).toBe(403);
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, adminUser.id));
    // The sign-up request leaves an authenticated session in this browser
    // context. Sign in again so better-auth projects the updated platform role.
    await page.context().clearCookies();

    await loginAndSelectBootstrapOrganization(page, bootstrap);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Administración" })
    ).toBeVisible();
    const templateResponse = await page.request.get(
      "/api/admin/product-imports/importers/zentro-standard-xlsx/template"
    );
    expect(templateResponse.ok()).toBe(true);
    expect(templateResponse.headers()["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(templateResponse.headers()["content-disposition"]).toContain(
      "plantilla-importacion-productos-zentro-v1.xlsx"
    );
    await page.getByText("Importaciones", { exact: true }).click();

    const productName = `Producto importado E2E ${Date.now()}`;
    const file = await buildProductFile(productName);
    await page
      .getByRole("combobox", { name: "Organización de destino" })
      .click();
    await page
      .getByRole("option", { name: new RegExp(bootstrap.orgName) })
      .click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "productos-e2e.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    });
    await page
      .getByRole("button", { name: "Previsualizar", exact: true })
      .click();

    await expect(page.getByText(productName, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmar importación" })
    ).toBeEnabled();
    await page.getByRole("button", { name: "Confirmar importación" }).click();

    const completedAlert = page.getByRole("alert", {
      name: "Importación completada",
    });
    await expect(completedAlert).toBeVisible();
    await expect(completedAlert).toContainText("Se crearon 1 productos");
    const importedRows = await db
      .select({ id: product.id, stock: product.stock })
      .from(product)
      .where(
        and(
          eq(product.organizationId, targetOrganization.id),
          eq(product.name, productName)
        )
      );
    expect(importedRows).toHaveLength(1);
    expect(importedRows[0].stock).toBe(7);

    const historyFilter = page.getByRole("combobox", {
      name: "Filtrar historial por organización",
    });
    await historyFilter.click();
    await page.getByRole("option", { name: emptyOrganizationName }).click();
    await expect(
      page.getByText("No hay importaciones para el filtro seleccionado.")
    ).toBeVisible();
    await expect(historyFilter).toBeVisible();
  });
});
