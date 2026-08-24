import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";

const FILTERS_BUTTON_PATTERN = /^Filtros/;
const PAID_OPTION_PATTERN = /^Pagada$/;
const PAID_CHIP_PATTERN = /^Estado: Pagada$/;

test.describe("sales filters — inline filter panel", () => {
  test("Selecting a filter keeps the panel open and shows a removable chip @smoke", {
    tag: ["@smoke", "@sales"],
  }, async ({ page }) => {
    const bootstrap = await createIsolatedE2EAccount(page.request);
    await loginAndSelectBootstrapOrganization(page, bootstrap);

    await page.goto("/sales");

    const filtersButton = page.getByRole("button", {
      name: FILTERS_BUTTON_PATTERN,
    });
    await expect(filtersButton).toBeVisible({ timeout: 15_000 });
    await filtersButton.click();

    const filtersPanelHeading = page.getByRole("heading", {
      name: "Filtros avanzados",
    });
    await expect(filtersPanelHeading).toBeVisible({ timeout: 5000 });

    // Picking an option keeps the panel open and updates the list in place.
    await page.getByRole("combobox", { name: "Estado" }).click();
    await page
      .getByRole("option")
      .filter({ hasText: PAID_OPTION_PATTERN })
      .first()
      .click();
    await expect(filtersPanelHeading).toBeVisible({ timeout: 5000 });
    await expect(filtersButton).toContainText("1");

    // Active filters surface as removable chips.
    const chip = page.getByRole("button", { name: PAID_CHIP_PATTERN });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(chip).toBeHidden();
    await expect(filtersButton).not.toContainText("1");
    await expect(filtersPanelHeading).toBeVisible();
  });
});
