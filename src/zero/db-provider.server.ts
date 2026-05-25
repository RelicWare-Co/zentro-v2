// Drizzle-backed `dbProvider` for the Zero `/api/zero/mutate` endpoint.
//
// `zeroDrizzle(schema, drizzleClient)` returns a `ZQLDatabase` that
// `handleMutateRequest` uses to:
//   1. Open a Postgres transaction.
//   2. Expose `tx.mutate.<table>.<op>` ZQL helpers backed by Drizzle.
//   3. Expose `tx.dbTransaction.wrappedTransaction` for raw Drizzle access
//      from server-only mutator overrides (`./mutators.server.ts`).
//
// We reuse the existing Drizzle client from `database/drizzle/db.ts` so
// connection pooling, env handling, and `postgres-js` driver tuning all live
// in one place.

import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { db } from "@/database/drizzle/db";
import { schema } from "./schema";

export const dbProvider = zeroDrizzle(schema, db);

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}
