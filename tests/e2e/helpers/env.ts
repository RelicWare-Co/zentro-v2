import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface E2EBootstrap {
  loginEmail: string;
  loginPassword: string;
  orgName: string;
  registerPassword: string;
}

let bootstrapCache: E2EBootstrap | null | undefined;

function getBootstrap(): E2EBootstrap | null {
  if (bootstrapCache !== undefined) {
    return bootstrapCache;
  }

  const bootstrapPath = path.join(
    process.cwd(),
    "playwright/.auth/e2e-bootstrap.json"
  );

  if (!existsSync(bootstrapPath)) {
    bootstrapCache = null;
    return null;
  }

  bootstrapCache = JSON.parse(
    readFileSync(bootstrapPath, "utf8")
  ) as E2EBootstrap;
  return bootstrapCache;
}

function readEnv(primary: string, legacy?: string): string | undefined {
  const value =
    process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
  return value && value.length > 0 ? value : undefined;
}

export function getLoginEmail(): string | undefined {
  return (
    readEnv("PLAYWRIGHT_LOGIN_EMAIL", "MAESTRO_LOGIN_EMAIL") ??
    getBootstrap()?.loginEmail
  );
}

export function getLoginPassword(): string | undefined {
  return (
    readEnv("PLAYWRIGHT_LOGIN_PASSWORD", "MAESTRO_LOGIN_PASSWORD") ??
    getBootstrap()?.loginPassword
  );
}

export function getOrgName(): string | undefined {
  return (
    readEnv("PLAYWRIGHT_ORG_NAME", "MAESTRO_ORG_NAME") ??
    getBootstrap()?.orgName
  );
}

export function getNewOrgName(): string {
  return (
    readEnv("PLAYWRIGHT_NEW_ORG_NAME", "MAESTRO_NEW_ORG_NAME") ??
    `Playwright Test Store ${Date.now()}`
  );
}

export function getRegisterName(): string {
  return (
    readEnv("PLAYWRIGHT_REGISTER_NAME", "MAESTRO_REGISTER_NAME") ??
    "Playwright E2E"
  );
}

export function getRegisterEmail(): string {
  return (
    readEnv("PLAYWRIGHT_REGISTER_EMAIL", "MAESTRO_REGISTER_EMAIL") ??
    `playwright-e2e-${Date.now()}@example.invalid`
  );
}

export function getRegisterPassword(): string | undefined {
  return (
    readEnv("PLAYWRIGHT_REGISTER_PASSWORD", "MAESTRO_REGISTER_PASSWORD") ??
    getBootstrap()?.registerPassword
  );
}

export function requireLoginEmail(): string {
  const email = getLoginEmail();
  if (!email) {
    throw new Error(
      "Set PLAYWRIGHT_LOGIN_EMAIL (or legacy MAESTRO_LOGIN_EMAIL)."
    );
  }
  return email;
}

export function requireLoginPassword(): string {
  const password = getLoginPassword();
  if (!password) {
    throw new Error(
      "Set PLAYWRIGHT_LOGIN_PASSWORD (or legacy MAESTRO_LOGIN_PASSWORD)."
    );
  }
  return password;
}

export function requireLoginCredentials(): {
  email: string;
  password: string;
} {
  const email = getLoginEmail();
  const password = getLoginPassword();
  if (!(email && password)) {
    throw new Error(
      "Set PLAYWRIGHT_LOGIN_EMAIL and PLAYWRIGHT_LOGIN_PASSWORD (or legacy MAESTRO_* vars)."
    );
  }
  return { email, password };
}

export function requireOrgName(): string {
  const orgName = getOrgName();
  if (!orgName) {
    throw new Error(
      "Set PLAYWRIGHT_ORG_NAME (or legacy MAESTRO_ORG_NAME) for organization selection."
    );
  }
  return orgName;
}
