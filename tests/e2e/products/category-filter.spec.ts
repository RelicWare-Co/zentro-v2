import { expect, type Locator, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { dbSqlite } from "@/database/drizzle/db";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";
import { openCreateProductSheet, openProductsPage } from "../helpers/products";

async function expectPaginationToFit(page: Page, totalProducts: Locator) {
  const paginationControls = [
    page.getByRole("button", { name: "Primera página" }),
    page.getByRole("button", { name: "Página anterior" }),
    page.getByRole("button", { name: "Página siguiente" }),
    page.getByRole("button", { name: "Última página" }),
  ];
  for (const control of paginationControls) {
    await expect(control).toBeVisible();
  }
  const controlBoxes = await Promise.all(
    paginationControls.map((control) => control.boundingBox())
  );
  const visibleControlBoxes = controlBoxes.filter(
    (box): box is NonNullable<typeof box> => box !== null
  );
  if (visibleControlBoxes.length !== paginationControls.length) {
    throw new Error("Could not measure every pagination control");
  }
  const controlTops = visibleControlBoxes.map((box) => box.y);
  expect
    .soft(Math.max(...controlTops) - Math.min(...controlTops))
    .toBeLessThanOrEqual(1);
  const footerBox = await totalProducts.locator("..").boundingBox();
  if (!footerBox) {
    throw new Error("Could not measure the products table footer");
  }
  expect
    .soft(Math.max(...visibleControlBoxes.map((box) => box.x + box.width)))
    .toBeLessThanOrEqual(footerBox.x + footerBox.width);
}

test.describe("products", () => {
  test("category pickers open unfiltered and pagination stays on one row @products", {
    tag: ["@products"],
  }, async ({ page }) => {
    test.setTimeout(60_000);
    const bootstrap = await createIsolatedE2EAccount(page.request);
    const db = dbSqlite();
    const [testOrganization] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, bootstrap.orgName))
      .limit(1);
    if (!testOrganization) {
      throw new Error("Could not resolve the isolated products fixture");
    }

    const categoryName = `Bebidas E2E ${Date.now()}`;
    const createdAt = new Date();
    await db.insert(category).values({
      id: crypto.randomUUID(),
      organizationId: testOrganization.id,
      name: categoryName,
      createdAt,
    });
    await db.insert(product).values(
      Array.from({ length: 21 }, (_, index) => ({
        id: crypto.randomUUID(),
        organizationId: testOrganization.id,
        name: `Producto paginado ${index + 1}`,
        price: 1000 + index,
        createdAt,
      }))
    );

    try {
      await page.setViewportSize({ height: 720, width: 1165 });
      await loginAndSelectBootstrapOrganization(page, bootstrap);
      await openProductsPage(page);
      const totalProducts = page.getByText("21 producto(s) en total", {
        exact: true,
      });
      await expect(totalProducts).toBeVisible({ timeout: 20_000 });

      const categoryFilter = page.getByRole("combobox", {
        name: "Filtrar por categoría",
      });
      await categoryFilter.click();
      await expect.soft(categoryFilter).toHaveValue("");
      await expect
        .soft(page.getByRole("option", { name: categoryName, exact: true }))
        .toBeVisible({ timeout: 15_000 });
      await categoryFilter.fill("bebidas");
      await expect(categoryFilter).toHaveValue("bebidas");
      await expect(
        page.getByRole("option", { name: categoryName, exact: true })
      ).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");

      await expectPaginationToFit(page, totalProducts);

      await openCreateProductSheet(page);
      const formCategory = page.getByLabel("Categoría", { exact: true });
      await formCategory.click();
      await expect.soft(formCategory).toHaveValue("");
      await expect
        .soft(page.getByRole("option", { name: categoryName, exact: true }))
        .toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();

      await page.setViewportSize({ height: 844, width: 390 });
      await expectPaginationToFit(page, totalProducts);
    } finally {
      await page.close();
      await db
        .delete(organization)
        .where(eq(organization.id, testOrganization.id));
      await db.delete(user).where(eq(user.email, bootstrap.loginEmail));
    }
  });
});
