import type { Session, User } from "better-auth/types";
import type { dbSqlite } from "./database/drizzle/db";

declare global {
  // biome-ignore lint/style/noNamespace: Vike requires namespace augmentation for global type merging
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
