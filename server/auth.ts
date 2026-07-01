import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { dbSqlite } from "@/database/drizzle/db";

function csvEnv(name: string) {
  return (
    process.env[name]?.split(",").flatMap((value) => {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }) ?? []
  );
}

function createAuth() {
  const cookieDomain = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
  const trustedOrigins = csvEnv("BETTER_AUTH_TRUSTED_ORIGINS");

  return betterAuth({
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      ...(cookieDomain
        ? {
            crossSubDomainCookies: {
              domain: cookieDomain,
              enabled: true,
            },
          }
        : {}),
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // Cache duration in seconds
      },
    },
    trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
    database: drizzleAdapter(dbSqlite(), {
      provider: "pg",
    }),
    experimental: { joins: true },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      admin(),
      organization({
        allowUserToCreateOrganization: () => true,
      }),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

let authInstance: Auth | undefined;

function getAuth(): Auth {
  if (authInstance) {
    return authInstance;
  }

  authInstance = createAuth();
  return authInstance;
}

export const auth = new Proxy({} as Auth, {
  get(_target, property, receiver) {
    const target = getAuth();
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
