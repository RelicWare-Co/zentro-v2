import { test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";
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
});
