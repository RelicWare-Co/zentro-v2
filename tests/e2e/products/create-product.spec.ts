import { test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import {
  expectProductInTable,
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

test.describe("products", () => {
  test("create product @smoke", { tag: ["@smoke", "@products"] }, async ({
    page,
  }) => {
    const productName = `Hola Mundo ${Date.now()}`;

    await loginAndSelectOrganization(page);
    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: productName,
      price: "99000",
    });

    await expectProductInTable(page, productName);
  });
});
