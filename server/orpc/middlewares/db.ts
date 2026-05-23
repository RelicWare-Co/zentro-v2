import { dbSqlite } from "@/database/drizzle/db";
import { base } from "../context";

export const dbMiddleware = base.middleware(({ context, next }) => {
  const db = context.db ?? dbSqlite();
  return next({ context: { db } });
});
