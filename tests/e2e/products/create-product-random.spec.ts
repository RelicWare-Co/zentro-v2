import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import {
  fillRandomProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

test.describe("products", () => {
  test("create product with random data @products", {
    tag: ["@products"],
  }, async ({ page }) => {
    await loginAndSelectOrganization(page);
    await openProductsPage(page);
    await openCreateProductSheet(page);

    const productName = await fillRandomProductForm(page);
    await expect(page.getByText(productName)).toBeVisible({
      timeout: 15_000,
    });
  });
});
