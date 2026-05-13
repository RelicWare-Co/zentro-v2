import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { dbSqlite } from "../database/drizzle/db";

function createAuth() {
  return betterAuth({
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // Cache duration in seconds
      },
    },
    database: drizzleAdapter(dbSqlite(), {
      provider: "sqlite",
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
