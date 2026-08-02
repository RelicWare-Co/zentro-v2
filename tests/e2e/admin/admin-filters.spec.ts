import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { dbSqlite } from "@/database/drizzle/db";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";
import { seedProduct, seedShift } from "../../helpers/seed";
import { loginAndSelectBootstrapOrganization } from "../helpers/auth";
import { createIsolatedE2EAccount } from "../helpers/bootstrap";

const USERS_FILTER_URL = /u_emailVerified=true/;
const USERS_ROLE_URL = /u_role=admin/;
const IMPORT_ORGANIZATION_URL = /i_organizationId=/;
const SALES_SORT_URL = /s_sortBy=createdAt/;
const PRESERVED_PARAM_URL = /keep=preserved/;
const USERS_TAB_URL = /adminTab=users/;

test.describe("admin filters, URL and keyboard", () => {
  test("restores filters, keeps unknown params and opens sale detail by keyboard", async ({
    page,
  }) => {
    const bootstrap = await createIsolatedE2EAccount(page.request);
    const db = dbSqlite();
    const [adminUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, bootstrap.loginEmail))
      .limit(1);
    const [adminOrganization] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, bootstrap.orgName))
      .limit(1);
    if (!(adminUser && adminOrganization)) {
      throw new Error("Could not resolve isolated admin fixtures");
    }

    const now = new Date();
    const bulkOrganizations = Array.from({ length: 105 }, (_, index) => ({
      id: crypto.randomUUID(),
      name:
        index === 104
          ? "ZZZ Outside First Hundred"
          : `Bulk Organization ${String(index).padStart(3, "0")}`,
      slug: `admin-filter-${Date.now()}-${index}`,
      createdAt: now,
    }));
    await db.insert(organization).values(bulkOrganizations);
    const outsideOrganization = bulkOrganizations[104];
    if (!outsideOrganization) {
      throw new Error("Missing organization fixture");
    }

    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId: adminOrganization.id,
        name: "Admin keyboard product",
        price: 12_000,
        stock: 5,
      }),
      seedShift(db, {
        organizationId: adminOrganization.id,
        userId: adminUser.id,
        status: "open",
      }),
    ]);
    const createdSale = await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 12_000 }],
        payments: [{ method: "cash", amount: 12_000 }],
      },
      {
        db,
        organizationId: adminOrganization.id,
        userId: adminUser.id,
      }
    );

    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, adminUser.id));
    await page.context().clearCookies();
    await loginAndSelectBootstrapOrganization(page, bootstrap);

    await page.goto("/admin?adminTab=users&keep=preserved");
    await page.getByPlaceholder("Verificación de email").click();
    await page.getByRole("option", { name: "Email verificado" }).click();
    await expect(page).toHaveURL(USERS_FILTER_URL);
    await page.getByPlaceholder("Rol").click();
    await page.getByRole("option", { name: "Administradores" }).click();
    await expect(page).toHaveURL(USERS_ROLE_URL);

    await page.reload();
    await expect(page.getByPlaceholder("Verificación de email")).toHaveValue(
      "Email verificado"
    );
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page).not.toHaveURL(USERS_FILTER_URL);
    await expect(page).toHaveURL(PRESERVED_PARAM_URL);
    await expect(page).toHaveURL(USERS_TAB_URL);

    await page.getByText("Ventas", { exact: true }).click();
    await page.getByRole("button", { name: "Fecha" }).click();
    await expect(page).toHaveURL(SALES_SORT_URL);
    const detailButton = page.getByRole("button", {
      name: `Ver detalle de venta ${createdSale.saleId}`,
    });
    await detailButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Detalle de venta", { exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("Detalle de venta", { exact: true })
    ).toBeHidden();
    await expect(detailButton).toBeFocused();

    await page.getByText("Importaciones", { exact: true }).click();
    const historyOrganization = page.getByLabel("Organización", {
      exact: true,
    });
    await historyOrganization.fill("ZZZ Outside First Hundred");
    await page
      .getByRole("option", { name: "ZZZ Outside First Hundred" })
      .click();
    await expect(page).toHaveURL(IMPORT_ORGANIZATION_URL);
    expect(new URL(page.url()).searchParams.get("i_organizationId")).toBe(
      outsideOrganization.id
    );
    await page.reload();
    await expect(historyOrganization).toHaveValue("ZZZ Outside First Hundred");
  });
});
