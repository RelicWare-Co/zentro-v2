import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";

const FILTERS_BUTTON_TEXT = /^Filtros$/;
const FILTERS_BUTTON_PATTERN = /Filtros/;

test.describe("sales advanced filters — Select inside Popover", () => {
  test("Select dropdown does not close the Popover on desktop @smoke", {
    tag: ["@smoke", "@sales"],
  }, async ({ page }) => {
    const bootstrap = await createIsolatedE2EAccount(page.request);
    await loginAndSelectBootstrapOrganization(page, bootstrap);

    await page.goto("/sales");

    await expect(
      page.getByRole("button", { name: FILTERS_BUTTON_PATTERN }).first()
    ).toBeVisible({ timeout: 15_000 });

    const filtersButton = page
      .locator("button")
      .filter({ hasText: FILTERS_BUTTON_TEXT })
      .first();
    await filtersButton.click();

    const popoverDropdown = page.locator(".zentro-overlay").last();
    await expect(popoverDropdown).toBeVisible({ timeout: 5000 });

    const firstSelect = popoverDropdown
      .locator("input[role='combobox']")
      .first();
    await firstSelect.click();

    const optionDropdown = page.locator(".zentro-overlay").last();
    await expect(optionDropdown).toBeVisible({ timeout: 5000 });

    const firstOption = optionDropdown.locator("[role='option']").first();
    await firstOption.click();

    await expect(
      popoverDropdown.filter({ hasText: "Filtros avanzados" })
    ).toBeVisible({ timeout: 5000 });
  });
});
