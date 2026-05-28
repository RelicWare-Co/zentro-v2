import { expect, test } from "@playwright/test";
import { createOrganization } from "../helpers/auth";
import { requireLoginCredentials } from "../helpers/env";

test.describe("auth", () => {
  test("create organization @organization", {
    tag: ["@organization", "@auth"],
  }, async ({ page }) => {
    requireLoginCredentials();

    await createOrganization(page);
    await expect(
      page.getByRole("heading", { name: "Panel de control" })
    ).toBeVisible();
  });
});
