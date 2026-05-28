import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import { requireLoginCredentials, requireOrgName } from "../helpers/env";
import {
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

const catalogProducts = [
  { name: "Camiseta Basica", price: "25000" },
  { name: "Zapatos Deportivos", price: "80000" },
  { name: "Bolso de Cuero", price: "45000" },
  { name: "Pantalon Slim", price: "60000" },
  { name: "Chaqueta de Invierno", price: "120000" },
] as const;

test.describe("products", () => {
  test("create product catalog @products", { tag: ["@products"] }, async ({
    page,
  }) => {
    requireLoginCredentials();
    requireOrgName();

    await loginAndSelectOrganization(page);
    await openProductsPage(page);

    for (const product of catalogProducts) {
      await openCreateProductSheet(page);
      await fillProductForm(page, product);
      await expect(page.getByText(product.name)).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
