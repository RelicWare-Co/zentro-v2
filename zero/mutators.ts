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

import { creditMutators } from "@/features/credit/credit.mutators";
import { customersMutators } from "@/features/customers/customers.mutators";
import { modulesMutators } from "@/features/modules/modules.mutators";
import { ordersMutators } from "@/features/orders/orders.mutators";
import { organizationMutators } from "@/features/organization/organization.mutators";
import { productsMutators } from "@/features/products/products.mutators";
import { restaurantsMutators } from "@/features/restaurants/restaurants.mutators";
import { salesMutators } from "@/features/sales/sales.mutators";
import { shiftsMutators } from "@/features/shifts/shifts.mutators";
import { defineZentroMutators } from "@/zero/sdk";

export const mutators = defineZentroMutators({
  ...customersMutators,
  ...productsMutators,
  ...creditMutators,
  ...salesMutators,
  ...ordersMutators,
  ...organizationMutators,
  ...modulesMutators,
  ...restaurantsMutators,
  ...shiftsMutators,
});

export type Mutators = typeof mutators;
