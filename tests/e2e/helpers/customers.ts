import { expect, type Page } from "@playwright/test";

const customersPageUrl = /\/customers(?:\/|$)/;

export async function openCustomersPage(page: Page): Promise<void> {
  await page.goto("/customers");
  await page.waitForURL(customersPageUrl, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function createCustomer(
  page: Page,
  options: { name: string; phone?: string }
): Promise<void> {
  await page.getByRole("button", { name: "Crear cliente" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Crear cliente" })
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Nombre").fill(options.name);
  if (options.phone) {
    await page.getByLabel("Teléfono").fill(options.phone);
  }

  await page.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar cliente" })
  ).not.toBeVisible({ timeout: 15_000 });

  await expect(
    page.getByRole("row").filter({ hasText: options.name })
  ).toBeVisible({ timeout: 15_000 });
}
