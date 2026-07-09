import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";
import {
  closeOpenShiftIfPresent,
  closeShiftWithExpectedCash,
  completeCashSale,
  openPosPage,
  openShift,
  registerCashMovement,
  searchAndAddProduct,
} from "../helpers/pos";
import {
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

const closedShiftBadgePattern = /Cerrado/;

test.describe("shift lifecycle", () => {
  test("open shift, cash movement, sale, and close @smoke", {
    tag: ["@smoke", "@shifts"],
  }, async ({ page }) => {
    const productName = `Shift Life ${Date.now()}`;
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
    await openShift(page, "50000");

    await registerCashMovement(page, {
      type: "inflow",
      amount: "5000",
      description: "Ingreso adicional de caja",
    });

    await searchAndAddProduct(page, productName);
    await completeCashSale(page, "10000");

    // Close shift: starting cash (50000) + inflow (5000) + cash sale (10000) = 70000.
    await closeShiftWithExpectedCash(page, "70000");

    await page.goto("/shifts");
    await expect(
      page.getByRole("heading", { name: "Turnos y cierres de caja" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: closedShiftBadgePattern })
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Movimientos de caja (1)")).toBeVisible({
      timeout: 15_000,
    });
  });
});
