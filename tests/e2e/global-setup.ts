import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { request } from "@playwright/test";

const bootstrapPassword = "PlaywrightTestPass123!";

export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_LOGIN_EMAIL || process.env.MAESTRO_LOGIN_EMAIL) {
    return;
  }

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.MAESTRO_BASE_URL ??
    "http://localhost:3000";

  const email = `playwright-${Date.now()}@example.invalid`;
  const orgName = `Playwright Org ${Date.now()}`;
  const slug = `playwright-org-${Date.now()}`;

  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
    },
  });

  const signUp = await api.post("/api/auth/sign-up/email", {
    data: {
      email,
      password: bootstrapPassword,
      name: "Playwright E2E",
    },
  });

  if (!signUp.ok()) {
    throw new Error(
      `E2E bootstrap sign-up failed (${signUp.status()}): ${await signUp.text()}`
    );
  }

  const createOrg = await api.post("/api/auth/organization/create", {
    data: {
      name: orgName,
      slug,
    },
  });

  if (!createOrg.ok()) {
    throw new Error(
      `E2E bootstrap organization create failed (${createOrg.status()}): ${await createOrg.text()}`
    );
  }

  await api.dispose();

  const authDir = path.join(process.cwd(), "playwright/.auth");
  mkdirSync(authDir, { recursive: true });
  writeFileSync(
    path.join(authDir, "e2e-bootstrap.json"),
    JSON.stringify(
      {
        loginEmail: email,
        loginPassword: bootstrapPassword,
        orgName,
        registerPassword: bootstrapPassword,
      },
      null,
      2
    )
  );
}
