// Shared Zero mutators.
//
// "Shared" means runnable on both client (optimistic) and server (authoritative).
// Anything that needs Drizzle, the better-auth instance, or other server-only
// modules belongs in `./mutators.server.ts` as an override.
//
// Conventions:
// - Validate `args` with Zod.
// - Always `await tx.mutate.*` writes; an unawaited write breaks transactionality.
// - Read identity/permissions from `ctx`. Reject mismatches with `throw new Error(...)`.
// - Mutators must be idempotent: Zero rebases optimistic mutations during
//   reconciliation, so the same mutator may execute multiple times locally.
//
// This registry starts empty on purpose. Add entries as features are migrated
// from oRPC routers; see `MIGRATION_PLAN.md` for the planned order.

import { defineMutators } from "@rocicorp/zero";
import "./context";

export const mutators = defineMutators({});

export type Mutators = typeof mutators;
