import {
  bootstrapPassword,
  type E2EBootstrap,
  readBootstrapCached,
} from "./bootstrap";

const PLACEHOLDER_LOGIN_EMAILS = new Set(["you@example.com"]);
const PLACEHOLDER_LOGIN_PASSWORDS = new Set(["your-password"]);

function readEnv(primary: string, legacy?: string): string | undefined {
  const value =
    process.env[primary] ?? (legacy ? process.env[legacy] : undefined);
  return value && value.length > 0 ? value : undefined;
}

function readLoginEmail(): string | undefined {
  const email = readEnv("PLAYWRIGHT_LOGIN_EMAIL", "MAESTRO_LOGIN_EMAIL");
  if (email && PLACEHOLDER_LOGIN_EMAILS.has(email)) {
    return;
  }
  return email;
}

function readLoginPassword(): string | undefined {
  const password = readEnv(
    "PLAYWRIGHT_LOGIN_PASSWORD",
    "MAESTRO_LOGIN_PASSWORD"
  );
  if (password && PLACEHOLDER_LOGIN_PASSWORDS.has(password)) {
    return;
  }
  return password;
}

function usesFixedCredentials(): boolean {
  return process.env.PLAYWRIGHT_USE_FIXED_CREDENTIALS === "1";
}

function getExplicitLoginCredentials(): {
  email: string;
  password: string;
} | null {
  const email = readLoginEmail();
  const password = readLoginPassword();

  if (email && password) {
    return { email, password };
  }

  if (email || password) {
    throw new Error(
      "Set both PLAYWRIGHT_LOGIN_EMAIL and PLAYWRIGHT_LOGIN_PASSWORD, or neither to use the auto-created bootstrap account."
    );
  }

  return null;
}

function getBootstrapCredentials(): E2EBootstrap | null {
  return readBootstrapCached();
}

function resolveCredentials(): { email: string; password: string } {
  if (!usesFixedCredentials()) {
    const bootstrap = getBootstrapCredentials();
    if (bootstrap) {
      return {
        email: bootstrap.loginEmail,
        password: bootstrap.loginPassword,
      };
    }
  }

  const explicit = getExplicitLoginCredentials();
  if (explicit) {
    return explicit;
  }

  const bootstrap = getBootstrapCredentials();
  if (bootstrap) {
    return {
      email: bootstrap.loginEmail,
      password: bootstrap.loginPassword,
    };
  }

  throw new Error(
    "No E2E credentials available. Run the full suite (auth.setup runs first) or use FRESH=1 ./scripts/e2e-playwright-run.sh."
  );
}

export function getLoginEmail(): string | undefined {
  return resolveCredentials().email;
}

export function getLoginPassword(): string | undefined {
  return resolveCredentials().password;
}

export function getOrgName(): string | undefined {
  if (!usesFixedCredentials()) {
    const bootstrap = getBootstrapCredentials();
    if (bootstrap) {
      return bootstrap.orgName;
    }
  }

  return (
    readEnv("PLAYWRIGHT_ORG_NAME", "MAESTRO_ORG_NAME") ??
    getBootstrapCredentials()?.orgName
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

export function getRegisterPassword(): string {
  const explicit = readEnv(
    "PLAYWRIGHT_REGISTER_PASSWORD",
    "MAESTRO_REGISTER_PASSWORD"
  );
  if (explicit) {
    return explicit;
  }

  return getBootstrapCredentials()?.registerPassword ?? bootstrapPassword;
}

export function requireLoginCredentials(): {
  email: string;
  password: string;
} {
  return resolveCredentials();
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
