import { expect, type Page } from "@playwright/test";

const settingsPageUrl = /\/settings(?:\/|$)/;

export async function openSettingsPage(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.waitForURL(settingsPageUrl, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Ajustes del negocio" })
  ).toBeVisible({ timeout: 15_000 });
}

export async function enableCreditSales(page: Page): Promise<void> {
  await openSettingsPage(page);

  const creditCard = page
    .locator("section, div")
    .filter({ hasText: "Crédito" })
    .filter({ hasText: "Permitir ventas a crédito" })
    .first();

  const creditToggle = creditCard
    .getByRole("switch")
    .or(creditCard.locator("input[type='checkbox']"))
    .first();

  const isChecked = await creditToggle
    .evaluate(
      (node) =>
        (node as HTMLInputElement).getAttribute("aria-checked") === "true" ||
        (node as HTMLInputElement).checked
    )
    .catch(() => false);

  if (!isChecked) {
    await creditToggle.click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByRole("button", { name: "Guardar cambios" })
    ).toBeDisabled({ timeout: 15_000 });
  }
}
