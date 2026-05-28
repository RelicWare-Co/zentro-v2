import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";
import { requireLoginCredentials, requireOrgName } from "../helpers/env";

test.describe("auth", () => {
  test("login and select organization @smoke", {
    tag: ["@smoke", "@auth"],
  }, async ({ page }) => {
    requireLoginCredentials();
    requireOrgName();

    await loginAndSelectOrganization(page);
    await expect(
      page.getByRole("heading", { name: "Panel de control" })
    ).toBeVisible();
  });
});
