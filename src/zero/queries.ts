// Shared Zero queries.
//
// Each entry is a named `defineQuery(...)` so the server endpoint
// (`/api/zero/query`) can re-derive the authoritative query text from
// `(name, args)` without trusting raw client AST.
//
// Conventions:
// - Always validate `args` with a Standard-Schema validator (Zod) when the
//   query takes inputs. The client may lie; the validator is the trust
//   boundary.
// - Always read identity/permissions from `ctx`, never from `args`.
// - When the user is not allowed to see anything, return an empty query
//   instead of throwing. Throwing on the server kills the whole batch.
// - Keep query text identical client/server — Zero merges them by name.

import { defineQueries, defineQuery } from "@rocicorp/zero";
// Importing `./context` registers `ZeroContext` into Zero's DefaultTypes so
// `ctx` here is typed as `ZeroContext | undefined`.
import "./context";
import { zql } from "./schema";

export const queries = defineQueries({
  /**
   * Returns the active membership rows of the authenticated user for their
   * active organization. Useful as a low-cost auth probe and for surfacing
   * the user's role in the UI (badges, conditional rendering).
   *
   * Logged-out clients receive an empty result via the `cmpLit(false, '=', true)`
   * permission gate (Zero's idiomatic "deny everything" predicate).
   */
  myMembership: defineQuery(({ ctx }) => {
    if (!ctx) {
      return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
});

export type Queries = typeof queries;
