import { expect, test } from "@playwright/test";
import { loginAndSelectOrganization } from "../helpers/auth";

test.describe("auth", () => {
  test("login and select organization @smoke", {
    tag: ["@smoke", "@auth"],
  }, async ({ page }) => {
    await loginAndSelectOrganization(page);
    await expect(
      page.getByRole("heading", { name: "Panel de control" })
    ).toBeVisible();
  });
});
