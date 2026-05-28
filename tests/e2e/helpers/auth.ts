import { expect, type Page } from "@playwright/test";
import { getNewOrgName, requireLoginCredentials, requireOrgName } from "./env";

async function submitLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function login(page: Page): Promise<void> {
  const { email, password } = requireLoginCredentials();

  await page.goto("/login");
  await submitLoginForm(page, email, password);

  await expect(
    page
      .getByRole("heading", { name: "Elige Cómo Quieres Entrar" })
      .or(page.getByRole("heading", { name: "Panel de control" }))
  ).toBeVisible({ timeout: 30_000 });
}

export async function selectOrganization(page: Page): Promise<void> {
  const orgHeading = page.getByRole("heading", {
    name: "Elige Cómo Quieres Entrar",
  });

  if (!(await orgHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
    return;
  }

  const orgName = requireOrgName();
  await expect(page.getByText(orgName, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button").filter({ hasText: orgName }).click();
  await expect(
    page.getByRole("heading", { name: "Panel de control" })
  ).toBeVisible({ timeout: 30_000 });
}

export async function loginAndSelectOrganization(page: Page): Promise<void> {
  await login(page);
  await selectOrganization(page);
  await expect(
    page.getByRole("heading", { name: "Panel de control" })
  ).toBeVisible({ timeout: 30_000 });
}

export async function createOrganization(page: Page): Promise<void> {
  const { email, password } = requireLoginCredentials();
  await page.goto("/login");
  await submitLoginForm(page, email, password);

  await expect(
    page.getByRole("heading", { name: "Elige Cómo Quieres Entrar" })
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Crear Nueva Organización" }).click();
  await expect(page.getByLabel("Nombre de la organización")).toBeVisible({
    timeout: 10_000,
  });

  const orgName = getNewOrgName();
  await page.getByLabel("Nombre de la organización").fill(orgName);
  await page.getByRole("button", { name: "Crear y Entrar" }).click();

  await expect(
    page.getByRole("heading", { name: "Panel de control" })
  ).toBeVisible({ timeout: 30_000 });
}
