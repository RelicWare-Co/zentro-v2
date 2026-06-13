// Hono handler for Zero's authoritative `/api/zero/query` and
// `/api/zero/mutate` endpoints.
//
// These endpoints exist alongside the existing oRPC `/api/*` routes so the
// migration can move surfaces over incrementally. Mounting order in
// `server/hono.ts` matters: this router must be added **before** the oRPC
// catch-all so `/api/zero/*` is not swallowed.
//
// Auth model:
// - Both endpoints derive identity from the better-auth cookie, **never**
//   from the request body.
// - Logged-out callers receive a normal Zero response with `userID: null`;
//   queries fall back to their "deny everything" branch (see
//   `zero/queries.ts`). We do not 401 here because zero-cache treats
//   401/403 specially (it puts the client into `needs-auth`).

import {
  type AnyCustomQuery,
  type Mutator,
  mustGetMutator,
  mustGetQuery,
} from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { dbProvider } from "@/zero/db-provider.server";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import { schema } from "@/zero/schema";
import { resolveZeroAuth } from "./context.server";

// `mustGetMutator` and `mustGetQuery` infer their return type from the
// registry. While the registries are empty (M0) the inferred type is `never`,
// which would block `.fn(...)` access. Once the migration adds entries the
// inferred types become correct on their own; the asserts below stay because
// they describe the structural contract regardless of registry size.
// biome-ignore-start lint/suspicious/noExplicitAny: structural escape hatch
// for dispatching to dynamically-named mutators/queries by string.
type AnyServerMutator = Mutator<any, any, any, any>;
// biome-ignore-end lint/suspicious/noExplicitAny: structural escape hatch
// for dispatching to dynamically-named mutators/queries by string.

export function createZeroApp() {
  const app = new Hono<EvlogVariables>();

  app.get("/context", async (c) => {
    const authBundle = await resolveZeroAuth(c.req.raw.headers);
    c.get("log").set({
      zero: "context",
      userId: authBundle?.userID ?? null,
    });

    return c.json({
      userID: authBundle?.userID ?? null,
      zeroContext: authBundle?.ctx ?? null,
    });
  });

  app.post("/query", async (c) => {
    const authBundle = await resolveZeroAuth(c.req.raw.headers);
    c.get("log").set({ zero: "query", userId: authBundle?.userID ?? null });

    const result = await handleQueryRequest({
      schema,
      request: c.req.raw,
      userID: authBundle?.userID ?? null,
      handler: (name, args) => {
        const query = mustGetQuery(queries, name) as AnyCustomQuery;
        return query.fn({ args, ctx: authBundle?.ctx });
      },
    });

    return c.json(result);
  });

  app.post("/mutate", async (c) => {
    const authBundle = await resolveZeroAuth(c.req.raw.headers);
    c.get("log").set({ zero: "mutate", userId: authBundle?.userID ?? null });

    const result = await handleMutateRequest({
      dbProvider,
      request: c.req.raw,
      userID: authBundle?.userID ?? null,
      handler: (transact) =>
        transact((tx, name, args) => {
          const mutator = mustGetMutator(
            serverMutators,
            name
          ) as AnyServerMutator;
          // The runtime `tx` is the same shape `mutator` expects, but the
          // generic dispatch loses the schema/wrapped-transaction parameters
          // that bound the registry. Cast through `unknown` so we can hand
          // the value across the dispatch boundary without dragging the full
          // schema type with us.
          return mutator.fn({
            tx: tx as unknown as Parameters<AnyServerMutator["fn"]>[0]["tx"],
            args,
            ctx: authBundle?.ctx,
          });
        }),
    });

    return c.json(result);
  });

  return app;
}
