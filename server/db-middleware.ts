import { enhance, type UniversalMiddleware } from "@universal-middleware/core";
import { dbSqlite } from "../database/drizzle/db";

declare global {
  // biome-ignore lint/style/noNamespace: third-party global namespace required by @universal-middleware/core
  namespace Universal {
    interface Context {
      db: ReturnType<typeof dbSqlite>;
    }
  }
}

// Note: You can directly define a server middleware instead of defining a Universal Middleware. (You can remove @universal-middleware/* — Vike's scaffolder uses it only to simplify its internal logic, see https://github.com/vikejs/vike/discussions/3116)
/**
 * Add the `db` object to the context.
 */
export const dbMiddleware: UniversalMiddleware = enhance(
  // The context we add here is automatically merged into pageContext
  (_request, context, _runtime) => {
    const db = dbSqlite();

    return {
      ...context,
      // Sets pageContext.db
      db,
    };
  },
  {
    name: "my-app:db-middleware",
    immutable: false,
  }
);
