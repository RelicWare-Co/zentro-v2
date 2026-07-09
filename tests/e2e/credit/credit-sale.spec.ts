import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";
import { createCustomer, openCustomersPage } from "../helpers/customers";
import {
  closeOpenShiftIfPresent,
  completeCreditSale,
  openPosPage,
  openShift,
  searchAndAddProduct,
} from "../helpers/pos";
import {
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";
import { enableCreditSales } from "../helpers/settings";

test.describe("credit-sale POS", () => {
  test("create credit account via sale, then record payment @smoke", {
    tag: ["@smoke", "@credit"],
  }, async ({ page }) => {
    const customerName = `Credit Customer ${Date.now()}`;
    const productName = `Credit Sale ${Date.now()}`;
    const bootstrap = await createIsolatedE2EAccount(page.request);
    // Clear API-set session cookies so loginAndSelectBootstrapOrganization
    // logs in via the UI form instead of racing the /login -> /organization
    // redirect when the shared browser context already holds a session.
    await page.context().clearCookies();

    await loginAndSelectBootstrapOrganization(page, bootstrap);

    await enableCreditSales(page);

    await openCustomersPage(page);
    await createCustomer(page, { name: customerName });

    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: productName,
      price: "15000",
      stock: "20",
    });

    await openPosPage(page);
    await closeOpenShiftIfPresent(page);
    await openShift(page, "50000");

    await searchAndAddProduct(page, productName);
    await completeCreditSale(page, { customerName });

    await page.goto("/credit");
    await expect(page.getByRole("heading", { name: "Crédito" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(customerName).first()).toBeVisible({
      timeout: 15_000,
    });

    const accountRow = page.getByRole("row").filter({ hasText: customerName });
    await expect(accountRow).toBeVisible({ timeout: 15_000 });
    await accountRow.getByRole("button", { name: "Registrar abono" }).click();

    const paymentDrawer = page.getByRole("dialog", { name: "Registrar abono" });
    await expect(paymentDrawer).toBeVisible({ timeout: 15_000 });
    await paymentDrawer.getByLabel("Monto").fill("5000");
    await paymentDrawer.getByLabel("Método de pago").click();
    await page.getByRole("option", { name: "Efectivo" }).click();
    await paymentDrawer
      .getByRole("button", { name: "Registrar abono" })
      .click();
    await expect(paymentDrawer).not.toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByRole("row").filter({ hasText: customerName })
    ).toBeVisible({ timeout: 15_000 });
  });
});
