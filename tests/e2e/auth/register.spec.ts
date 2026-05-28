import { expect, test } from "@playwright/test";
import {
  getRegisterEmail,
  getRegisterName,
  getRegisterPassword,
} from "../helpers/env";

const createAccountHeading = /Crea tu cuenta/;
const emailField = /Correo electrónico/;
const passwordField = /^Contraseña/;
const confirmPasswordField = /Confirmar contraseña/;

async function openRegisterForm(page: import("@playwright/test").Page) {
  await page.goto("/login");

  const signOutButton = page.getByRole("button", { name: "Cerrar sesión" });
  if (await signOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signOutButton.click();
    await page.goto("/login");
  }

  await page.getByRole("button", { name: "Registrarse" }).click();
}

test.describe("auth", () => {
  test("register new account @smoke", { tag: ["@smoke", "@auth"] }, async ({
    page,
  }) => {
    const password = getRegisterPassword();

    await openRegisterForm(page);

    await expect(
      page.getByRole("heading", { name: createAccountHeading })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Tu nombre…").fill(getRegisterName());
    await page
      .getByRole("textbox", { name: emailField })
      .fill(getRegisterEmail());
    await page
      .getByRole("textbox", { name: passwordField })
      .first()
      .fill(password);
    await page
      .getByRole("textbox", { name: confirmPasswordField })
      .fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(
      page.getByRole("heading", { name: "Elige Cómo Quieres Entrar" })
    ).toBeVisible({ timeout: 30_000 });
  });
});
