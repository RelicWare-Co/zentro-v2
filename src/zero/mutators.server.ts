// Server-side mutator registry.
//
// This is the **authoritative** version of `mutators`. The Zero `/api/zero/mutate`
// endpoint resolves names against this registry, while the client uses
// `./mutators.ts` for optimistic execution.
//
// The two registries can differ:
// - The shared registry runs inside the browser SQLite-replica transaction;
//   it has no access to Drizzle, the auth instance, evlog, etc.
// - The server registry can override individual mutators to add hard
//   validation, side-effects (notifications, audit logs), or to read/write
//   tables that aren't safe to expose to the optimistic path.
//
// Override pattern (when a feature is migrated):
//
//     export const serverMutators = defineMutators(sharedMutators, {
//       customers: {
//         create: defineMutator(
//           sharedMutators.customers.create.schema,
//           async ({ tx, args, ctx }) => {
//             // tx.dbTransaction.wrappedTransaction is the Drizzle tx.
//             // Run hard validation here (uniqueness, cross-table invariants),
//             // then delegate to the shared implementation if you want the
//             // exact same row writes.
//             await sharedMutators.customers.create.fn({ tx, args, ctx });
//           },
//         ),
//       },
//     });

import { defineMutators } from "@rocicorp/zero";
import { mutators as sharedMutators } from "./mutators";

export const serverMutators = defineMutators(sharedMutators, {});

export type ServerMutators = typeof serverMutators;
