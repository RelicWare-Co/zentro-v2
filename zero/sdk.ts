// Internal Zero SDK for this app.
//
// Feature slices should import Zero definition helpers from here instead of
// reaching directly into `@rocicorp/zero`. This keeps the app's schema/context
// binding and common authorization helpers in one stable place while still
// exposing normal ZQL to the domain code.

import {
  type DefaultWrappedTransaction,
  defineMutatorsWithType,
  defineMutatorWithType,
  defineQueriesWithType,
  defineQueryWithType,
} from "@rocicorp/zero";
import type { ZeroContext } from "@/zero/context";
import type { Schema } from "@/zero/schema";
import "@/zero/context";

export const defineZentroQuery = defineQueryWithType<
  Schema,
  ZeroContext | undefined
>();
export const defineZentroQueries = defineQueriesWithType<Schema>();
export const defineZentroMutator = defineMutatorWithType<
  Schema,
  ZeroContext | undefined,
  DefaultWrappedTransaction
>();
export const defineZentroMutators = defineMutatorsWithType<Schema>();

// biome-ignore-start lint/performance/noBarrelFile: this file is the intentional internal Zero SDK facade.
export type { ZeroContext } from "@/zero/context";
export type { Schema } from "@/zero/schema";
export {
  assertOrgZeroContext,
  assertZeroContext,
  FORBIDDEN_MESSAGE,
  getOrganizationSettingsFromTx,
  normalizeOptionalString,
  normalizeRequiredString,
  requireOrgContext,
  resolveTimestamp,
  toInteger,
  toNonNegativeInteger,
  toPositiveInteger,
  type ZeroMutatorTransaction,
} from "./mutators.shared";
export {
  denyAllMembers,
  denyQuery,
  hasOrgContext,
  type ZeroOrgContext,
} from "./queries.shared";
// biome-ignore-end lint/performance/noBarrelFile: this file is the intentional internal Zero SDK facade.
