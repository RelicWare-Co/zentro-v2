import { expect, type Page } from "@playwright/test";

const productsPageUrl = /\/products(?:\/|$)/;

export async function openProductsPage(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Productos" }).click();
  await page.waitForURL(productsPageUrl, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Agregar producto" })
  ).toBeVisible({ timeout: 15_000 });
}

export async function openCreateProductSheet(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Agregar producto" }).click();
  await expect(
    page.getByRole("heading", { name: "Crear producto" })
  ).toBeVisible({ timeout: 10_000 });
}

export async function fillProductForm(
  page: Page,
  options: { name: string; price: string }
): Promise<void> {
  await page.locator("#product-form-name").fill(options.name);
  await page.locator("#product-form-price").fill("");
  await page.locator("#product-form-price").fill(options.price);
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar producto" })
  ).not.toBeVisible({ timeout: 15_000 });
}

export async function expectProductInTable(
  page: Page,
  name: string
): Promise<void> {
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible({
    timeout: 15_000,
  });
}

export async function fillRandomProductForm(page: Page): Promise<string> {
  const productName = `Product_${Math.floor(Math.random() * 10_000)}`;
  const randomDigits = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

  await page.locator("#product-form-name").fill(productName);
  await page.locator("#product-form-barcode").fill(randomDigits(9));

  await page.locator("#product-form-price").fill("");
  await page.locator("#product-form-price").fill(randomDigits(5));

  await page.locator("#product-form-cost").fill("");
  await page.locator("#product-form-cost").fill(randomDigits(4));

  await page.locator("#product-form-stock").fill("");
  await page.locator("#product-form-stock").fill(randomDigits(2));

  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar producto" })
  ).not.toBeVisible({ timeout: 15_000 });

  return productName;
}
