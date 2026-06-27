// Server-only Zero SDK helpers.
//
// Feature `.server.ts` files should import `defineZentroServerMutator` and
// `requireServerDrizzleTransaction` from here instead of repeating the
// auth-check + transaction-extraction boilerplate in every mutator override.
//
// This file is server-only: it must never enter the client bundle.

import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import type { ZeroContext } from "@/zero/context";
import {
  defineZentroMutator,
  requireOrgContext,
  type ZeroMutatorTransaction,
} from "@/zero/sdk";

export type DrizzleTransaction = Database;

export interface ZentroServerMutatorAuth {
  organizationId: string;
  userId: string;
  zeroContext: ZeroContext & { orgID: string };
}

interface ServerBackedTransaction {
  dbTransaction: {
    wrappedTransaction: Database;
  };
}

function isServerBackedTransaction(
  tx: ZeroMutatorTransaction
): tx is ZeroMutatorTransaction & ServerBackedTransaction {
  return "dbTransaction" in tx;
}

export function requireServerDrizzleTransaction(
  tx: ZeroMutatorTransaction,
  operationName: string
): DrizzleTransaction {
  if (!isServerBackedTransaction(tx)) {
    throw new Error(`${operationName} solo puede ejecutarse en el servidor`);
  }
  return tx.dbTransaction.wrappedTransaction;
}

export function resolveServerAuth(
  ctx: ZeroContext | undefined
): ZentroServerMutatorAuth {
  const zeroContext = requireOrgContext(ctx);
  return {
    organizationId: zeroContext.orgID,
    userId: zeroContext.id,
    zeroContext,
  };
}

export function defineZentroServerMutator<TSchema extends z.ZodType>(
  schema: TSchema,
  runner: (params: {
    drizzleTx: DrizzleTransaction;
    args: z.infer<TSchema>;
    auth: ZentroServerMutatorAuth;
  }) => Promise<void>,
  options?: { operationName?: string }
) {
  const operationName = options?.operationName ?? "Esta operación";
  // biome-ignore lint/suspicious/noExplicitAny: args type is enforced by the generic TSchema
  return defineZentroMutator(schema as any, async ({ tx, args, ctx }) => {
    const auth = resolveServerAuth(ctx);
    const drizzleTx = requireServerDrizzleTransaction(tx, operationName);
    await runner({ drizzleTx, args: args as z.infer<TSchema>, auth });
  });
}
