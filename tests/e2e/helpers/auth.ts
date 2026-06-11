import { expect, type Page } from "@playwright/test";
import {
  type E2EBootstrap,
  ensureE2EBootstrap,
  invalidateBootstrapCache,
} from "./bootstrap";
import { getNewOrgName, requireLoginCredentials, requireOrgName } from "./env";

const invalidCredentialsPattern =
  /Invalid email or password|Credenciales inválidas/i;

async function isLoggedIn(page: Page): Promise<boolean> {
  const orgHeading = page.getByRole("heading", {
    name: "Elige Cómo Quieres Entrar",
  });
  const dashboardHeading = page.getByRole("heading", {
    name: "Panel de control",
  });

  return (
    (await orgHeading.isVisible({ timeout: 3000 }).catch(() => false)) ||
    (await dashboardHeading.isVisible({ timeout: 3000 }).catch(() => false))
  );
}

async function submitLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const loginTab = page.getByRole("button", { name: "Iniciar sesión" });
  if (await loginTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginTab.click();
  }

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function waitForPostLogin(page: Page): Promise<void> {
  const invalidCredentials = page.getByText(invalidCredentialsPattern);
  if (
    await invalidCredentials.isVisible({ timeout: 5000 }).catch(() => false)
  ) {
    const { email } = requireLoginCredentials();
    throw new Error(
      `Login failed for ${email}. If the DB was reset, run FRESH=1 ./scripts/e2e-playwright-run.sh. If using PLAYWRIGHT_* vars, verify the account exists.`
    );
  }

  await expect(
    page
      .getByRole("heading", { name: "Elige Cómo Quieres Entrar" })
      .or(page.getByRole("heading", { name: "Panel de control" }))
  ).toBeVisible({ timeout: 30_000 });
}

export async function login(page: Page): Promise<void> {
  await ensureE2EBootstrap(page.request);
  invalidateBootstrapCache();

  const { email, password } = requireLoginCredentials();

  await page.goto("/login");
  await expect(
    page
      .locator('input[name="email"]')
      .or(page.getByRole("heading", { name: "Elige Cómo Quieres Entrar" }))
      .or(page.getByRole("heading", { name: "Panel de control" }))
  ).toBeVisible({ timeout: 15_000 });

  if (await isLoggedIn(page)) {
    return;
  }

  if (
    !(await page
      .locator('input[name="email"]')
      .isVisible({ timeout: 3000 })
      .catch(() => false))
  ) {
    await waitForPostLogin(page);
    return;
  }

  await submitLoginForm(page, email, password);
  await waitForPostLogin(page);
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

export async function loginAndSelectBootstrapOrganization(
  page: Page,
  bootstrap: E2EBootstrap
): Promise<void> {
  await page.goto("/login");
  await expect(
    page
      .locator('input[name="email"]')
      .or(page.getByRole("heading", { name: "Elige Cómo Quieres Entrar" }))
      .or(page.getByRole("heading", { name: "Panel de control" }))
  ).toBeVisible({ timeout: 15_000 });

  if (!(await isLoggedIn(page))) {
    await submitLoginForm(page, bootstrap.loginEmail, bootstrap.loginPassword);
    await waitForPostLogin(page);
  }

  const orgHeading = page.getByRole("heading", {
    name: "Elige Cómo Quieres Entrar",
  });
  if (await orgHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
    await expect(
      page.getByText(bootstrap.orgName, { exact: true })
    ).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByRole("button")
      .filter({ hasText: bootstrap.orgName })
      .click();
  }

  await expect(
    page.getByRole("heading", { name: "Panel de control" })
  ).toBeVisible({ timeout: 30_000 });
}

export async function createOrganization(page: Page): Promise<void> {
  await ensureE2EBootstrap(page.request);
  invalidateBootstrapCache();

  const { email, password } = requireLoginCredentials();
  await page.goto("/login");

  if (!(await isLoggedIn(page))) {
    await submitLoginForm(page, email, password);
    await waitForPostLogin(page);
  }

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
