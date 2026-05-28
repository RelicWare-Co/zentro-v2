import { test as setup } from "@playwright/test";
import { ensureE2EBootstrap } from "./helpers/bootstrap";

setup("prepare e2e account", async ({ request }) => {
  await ensureE2EBootstrap(request);
});
