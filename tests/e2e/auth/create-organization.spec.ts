import { expect, test } from "@playwright/test";
import { createOrganization } from "../helpers/auth";

test.describe("auth", () => {
  test("create organization @organization", {
    tag: ["@organization", "@auth"],
  }, async ({ page }) => {
    await createOrganization(page);
    await expect(
      page.getByRole("heading", { name: "Panel de control" })
    ).toBeVisible();
  });
});
