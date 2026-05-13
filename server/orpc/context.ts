import { os } from "@orpc/server";
import type { RequestLogger } from "evlog";
import type { dbSqlite } from "../../database/drizzle/db";

export interface AppContext {
  db: ReturnType<typeof dbSqlite>;
  headers: Headers;
  log: RequestLogger;
}

export const base = os.$context<AppContext>();
