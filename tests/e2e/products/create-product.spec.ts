import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import { requireLoginCredentials, requireOrgName } from "../helpers/env";
import {
  fillProductForm,
  openCreateProductSheet,
  openProductsPage,
} from "../helpers/products";

test.describe("products", () => {
  test("create product @smoke", { tag: ["@smoke", "@products"] }, async ({
    page,
  }) => {
    requireLoginCredentials();
    requireOrgName();

    await loginAndSelectOrganization(page);
    await openProductsPage(page);
    await openCreateProductSheet(page);
    await fillProductForm(page, {
      name: "Hola Mundo",
      price: "99000",
    });

    await expect(page.getByText("Hola Mundo")).toBeVisible({
      timeout: 15_000,
    });
  });
});
