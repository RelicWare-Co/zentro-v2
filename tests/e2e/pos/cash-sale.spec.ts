import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";
import { createCustomer, openCustomersPage } from "../helpers/customers";
import {
  closeOpenShiftIfPresent,
  completeCashSale,
  openPosPage,
  openShift,
  searchAndAddProduct,
} from "../helpers/pos";
import {
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

test.describe("pos checkout", () => {
  test("cash sale @smoke", { tag: ["@smoke", "@pos"] }, async ({ page }) => {
    const productName = `POS Cash ${Date.now()}`;
    const bootstrap = await createIsolatedE2EAccount(page.request);

    await loginAndSelectBootstrapOrganization(page, bootstrap);
    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: productName,
      price: "10000",
      stock: "20",
    });

    await openPosPage(page);
    await closeOpenShiftIfPresent(page);
    await openShift(page);
    await searchAndAddProduct(page, productName);
    await completeCashSale(page, "10000");
  });

  test("clears a stock error after removing the rejected product", async ({
    page,
  }) => {
    const outOfStockProductName = `POS Empty ${Date.now()}`;
    const replacementProductName = `POS Replacement ${Date.now()}`;
    const bootstrap = await createIsolatedE2EAccount(page.request);

    await loginAndSelectBootstrapOrganization(page, bootstrap);
    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: outOfStockProductName,
      price: "10000",
      stock: "0",
    });
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: replacementProductName,
      price: "10000",
      stock: "20",
    });

    await openPosPage(page);
    await closeOpenShiftIfPresent(page);
    await openShift(page);
    await searchAndAddProduct(page, outOfStockProductName);
    await page.getByRole("button", { name: "Cobrar" }).click();

    const checkoutDialog = page.getByRole("dialog", { name: "Cobrar Orden" });
    await expect(checkoutDialog).toBeVisible({ timeout: 15_000 });
    await checkoutDialog.getByPlaceholder("Monto").fill("10000");
    await checkoutDialog
      .getByRole("button", { name: "Finalizar Venta" })
      .click();

    const stockError = checkoutDialog.getByText(
      `Stock insuficiente para ${outOfStockProductName}`,
      { exact: true }
    );
    await expect(stockError).toBeVisible({ timeout: 30_000 });

    await checkoutDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(checkoutDialog).not.toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Eliminar producto" }).click();

    await searchAndAddProduct(page, replacementProductName);
    await page.getByRole("button", { name: "Cobrar" }).click();
    await expect(checkoutDialog).toBeVisible({ timeout: 15_000 });
    await expect(stockError).not.toBeVisible();
  });

  test("resets the customer after completing a sale", async ({ page }) => {
    const customerName = `POS Customer ${Date.now()}`;
    const productName = `POS Customer Sale ${Date.now()}`;
    const bootstrap = await createIsolatedE2EAccount(page.request);

    await loginAndSelectBootstrapOrganization(page, bootstrap);
    await openCustomersPage(page);
    await createCustomer(page, { name: customerName });
    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: productName,
      price: "10000",
      stock: "20",
    });

    await openPosPage(page);
    await closeOpenShiftIfPresent(page);
    await openShift(page);
    await searchAndAddProduct(page, productName);
    await page.getByRole("button", { name: "Cobrar" }).click();

    const checkoutDialog = page.getByRole("dialog", { name: "Cobrar Orden" });
    await expect(checkoutDialog).toBeVisible({ timeout: 15_000 });
    await checkoutDialog
      .getByRole("button", { name: "Cliente Mostrador" })
      .click();
    await page
      .getByRole("option", { name: customerName, exact: false })
      .click();
    await checkoutDialog.getByPlaceholder("Monto").fill("10000");
    await checkoutDialog
      .getByRole("button", { name: "Finalizar Venta" })
      .click();
    await expect(
      page.getByText("Escanea o selecciona un producto")
    ).toBeVisible({ timeout: 30_000 });

    await searchAndAddProduct(page, productName);
    await page.getByRole("button", { name: "Cobrar" }).click();
    await expect(checkoutDialog).toBeVisible({ timeout: 15_000 });
    await expect(
      checkoutDialog.getByText("Cliente Mostrador", { exact: true })
    ).toBeVisible();
  });
});
