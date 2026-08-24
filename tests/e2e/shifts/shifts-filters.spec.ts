import { expect, test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";

const FILTERS_BUTTON_PATTERN = /^Filtros/;
const OPEN_OPTION_PATTERN = /^Abierto$/;
const OPEN_CHIP_PATTERN = /^Estado: Abierto$/;

test.describe("shifts filters — unified filter panel", () => {
  test("all filters live in one panel, apply immediately, and clear @smoke", {
    tag: ["@smoke", "@shifts"],
  }, async ({ page }) => {
    const bootstrap = await createIsolatedE2EAccount(page.request);
    await loginAndSelectBootstrapOrganization(page, bootstrap);

    await page.goto("/shifts");
    await expect(
      page.getByRole("heading", { name: "Turnos y cierres de caja" })
    ).toBeVisible({ timeout: 15_000 });

    const filtersButton = page.getByRole("button", {
      name: FILTERS_BUTTON_PATTERN,
    });
    await expect(filtersButton).toBeVisible({ timeout: 15_000 });
    await filtersButton.click();

    const filtersPanelHeading = page.getByRole("heading", {
      name: "Filtros avanzados",
    });
    await expect(filtersPanelHeading).toBeVisible({ timeout: 5000 });

    // Every filter lives in the single panel — no duplicated inline selects.
    for (const name of [
      "Estado",
      "Diferencia",
      "Movimientos",
      "Cajero",
      "Medio de pago",
      "Terminal",
    ]) {
      await expect(page.getByRole("combobox", { name })).toBeVisible();
    }

    // Filters apply immediately and surface an active-count badge and a chip.
    await page.getByRole("combobox", { name: "Estado" }).click();
    await page
      .getByRole("option")
      .filter({ hasText: OPEN_OPTION_PATTERN })
      .first()
      .click();
    await expect(filtersButton).toContainText("1");

    const chip = page.getByRole("button", { name: OPEN_CHIP_PATTERN });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(chip).toBeHidden();
    await expect(filtersButton).not.toContainText("1");

    // Re-apply, collapse the panel, and clear from the toolbar.
    await page.getByRole("combobox", { name: "Estado" }).click();
    await page
      .getByRole("option")
      .filter({ hasText: OPEN_OPTION_PATTERN })
      .first()
      .click();
    await expect(filtersButton).toContainText("1");

    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(filtersPanelHeading).toBeHidden();

    const clearButton = page.getByRole("button", { name: "Limpiar" });
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await expect(clearButton).toBeHidden();
    await expect(filtersButton).not.toContainText("1");
  });
});
