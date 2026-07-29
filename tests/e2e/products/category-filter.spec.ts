import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import { openProductsPage } from "../helpers/products";

test.describe("products", () => {
  test("searches the category filter @products", {
    tag: ["@products"],
  }, async ({ page }) => {
    await loginAndSelectOrganization(page);
    await openProductsPage(page);

    const categoryFilter = page.getByRole("combobox", {
      name: "Filtrar por categoría",
    });
    await categoryFilter.fill("bebidas");

    await expect(categoryFilter).toHaveValue("bebidas");
  });
});
