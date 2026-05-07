import type { dbSqlite } from "./database/drizzle/db";
import type { User, Session } from "better-auth/types";

declare global {
  namespace Vike {
    interface PageContextServer {
      db: ReturnType<typeof dbSqlite>;
    }
    interface PageContext {
      user: User | null;
      session: Session | null;
    }
    interface Server {
      server: "hono";
    }
  }
}
