import { test } from "@playwright/test";
import { loginAndSelectBootstrapOrganization } from "./helpers/auth";
import { createIsolatedE2EAccount } from "./helpers/bootstrap";

const FILTERS_BUTTON_PATTERN = /^Filtros/;
const PAID_OPTION_PATTERN = /^Pagada$/;
const OPEN_OPTION_PATTERN = /^Abierto$/;

test("panel shots", async ({ page }) => {
  const bootstrap = await createIsolatedE2EAccount(page.request);
  await loginAndSelectBootstrapOrganization(page, bootstrap);

  await page.goto("/sales");
  await page.getByRole("button", { name: FILTERS_BUTTON_PATTERN }).click();
  await page.getByRole("heading", { name: "Filtros avanzados" }).waitFor();
  await page.getByRole("combobox", { name: "Estado" }).click();
  await page
    .getByRole("option")
    .filter({ hasText: PAID_OPTION_PATTERN })
    .first()
    .click();
  await page.screenshot({ path: "/tmp/zentro-sales-panel.png" });

  await page.goto("/shifts");
  await page.getByRole("button", { name: FILTERS_BUTTON_PATTERN }).click();
  await page.getByRole("heading", { name: "Filtros avanzados" }).waitFor();
  await page.getByRole("combobox", { name: "Estado" }).click();
  await page
    .getByRole("option")
    .filter({ hasText: OPEN_OPTION_PATTERN })
    .first()
    .click();
  await page.screenshot({ path: "/tmp/zentro-shifts-panel.png" });
});
