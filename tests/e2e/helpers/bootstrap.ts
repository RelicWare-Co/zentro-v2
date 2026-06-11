import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

export const bootstrapPassword = "PlaywrightTestPass123!";

export const bootstrapPath = path.join(
  process.cwd(),
  "playwright/.auth/e2e-bootstrap.json"
);

export interface E2EBootstrap {
  loginEmail: string;
  loginPassword: string;
  orgName: string;
  registerPassword: string;
}

let bootstrapCache: E2EBootstrap | null | undefined;

function readEnv(primary: string, legacy?: string): string | undefined {
  const value =
    process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
  return value && value.length > 0 ? value : undefined;
}

function getBaseURL(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.MAESTRO_BASE_URL ??
    "http://localhost:3000"
  );
}

function authHeaders(): Record<string, string> {
  return { Origin: getBaseURL() };
}

function readLoginEmail(): string | undefined {
  const email = readEnv("PLAYWRIGHT_LOGIN_EMAIL", "MAESTRO_LOGIN_EMAIL");
  if (email === "you@example.com") {
    return;
  }
  return email;
}

function readLoginPassword(): string | undefined {
  const password = readEnv(
    "PLAYWRIGHT_LOGIN_PASSWORD",
    "MAESTRO_LOGIN_PASSWORD"
  );
  if (password === "your-password") {
    return;
  }
  return password;
}

export function hasExplicitCredentials(): boolean {
  const email = readLoginEmail();
  const password = readLoginPassword();
  return Boolean(email && password);
}

export function hasPartialExplicitCredentials(): boolean {
  const email = readLoginEmail();
  const password = readLoginPassword();
  return Boolean(email || password) && !hasExplicitCredentials();
}

export function shouldFreshBootstrap(): boolean {
  return process.env.FRESH === "1" || process.env.PLAYWRIGHT_E2E_FRESH === "1";
}

export function readBootstrapFile(): E2EBootstrap | null {
  if (!existsSync(bootstrapPath)) {
    return null;
  }

  return JSON.parse(readFileSync(bootstrapPath, "utf8")) as E2EBootstrap;
}

export function readBootstrapCached(): E2EBootstrap | null {
  if (bootstrapCache !== undefined) {
    return bootstrapCache;
  }

  bootstrapCache = readBootstrapFile();
  return bootstrapCache;
}

export function invalidateBootstrapCache(): void {
  bootstrapCache = undefined;
}

export function writeBootstrapFile(data: E2EBootstrap): void {
  mkdirSync(path.dirname(bootstrapPath), { recursive: true });
  writeFileSync(bootstrapPath, JSON.stringify(data, null, 2));
  invalidateBootstrapCache();
}

async function signIn(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<boolean> {
  const response = await request.post("/api/auth/sign-in/email", {
    headers: authHeaders(),
    data: { email, password },
  });
  return response.ok();
}

async function createBootstrapAccount(
  request: APIRequestContext
): Promise<E2EBootstrap> {
  const email = `playwright-${Date.now()}@example.invalid`;
  const orgName = `Playwright Org ${Date.now()}`;
  const slug = `playwright-org-${Date.now()}`;

  const signUp = await request.post("/api/auth/sign-up/email", {
    headers: authHeaders(),
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

  const signedIn = await signIn(request, email, bootstrapPassword);
  if (!signedIn) {
    throw new Error("E2E bootstrap sign-in failed after sign-up.");
  }

  const createOrg = await request.post("/api/auth/organization/create", {
    headers: authHeaders(),
    data: { name: orgName, slug },
  });

  if (!createOrg.ok()) {
    throw new Error(
      `E2E bootstrap organization create failed (${createOrg.status()}): ${await createOrg.text()}`
    );
  }

  return {
    loginEmail: email,
    loginPassword: bootstrapPassword,
    orgName,
    registerPassword: bootstrapPassword,
  };
}

export async function createIsolatedE2EAccount(
  request: APIRequestContext
): Promise<E2EBootstrap> {
  return await createBootstrapAccount(request);
}

export async function ensureE2EBootstrap(
  request: APIRequestContext
): Promise<void> {
  if (hasPartialExplicitCredentials()) {
    throw new Error(
      "Set both PLAYWRIGHT_LOGIN_EMAIL and PLAYWRIGHT_LOGIN_PASSWORD, or clear them to use the auto-created bootstrap account."
    );
  }

  if (hasExplicitCredentials()) {
    const email = readLoginEmail();
    const password = readLoginPassword();
    if (!(email && password)) {
      return;
    }

    const signedIn = await signIn(request, email, password);
    if (signedIn) {
      return;
    }

    process.stderr.write(
      `[e2e] Sign-in failed for ${email} (PLAYWRIGHT_LOGIN_* / MAESTRO_LOGIN_*). ` +
        "Creating a bootstrap account instead. Unset those vars to silence this message.\n"
    );
  }

  if (!shouldFreshBootstrap()) {
    const existing = readBootstrapFile();
    if (
      existing &&
      (await signIn(request, existing.loginEmail, existing.loginPassword))
    ) {
      return;
    }
  }

  writeBootstrapFile(await createBootstrapAccount(request));
}
