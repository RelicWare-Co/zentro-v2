import type { Session, User } from "better-auth/types";
import type { dbSqlite } from "./database/drizzle/db";

declare global {
  namespace Vike {
    interface PageContextServer {
      db: ReturnType<typeof dbSqlite>;
    }
    interface PageContext {
      session: Session | null;
      user: User | null;
    }
    interface Server {
      server: "hono";
    }
  }
}
