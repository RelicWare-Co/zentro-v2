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

import {
  defineMutator,
  defineMutators,
  type Transaction,
} from "@rocicorp/zero";
import {
  CreateCustomerSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/schemas/customers";
import "./context";
import { type Schema, type ZeroContext, zql } from "./schema";

type CustomerMutatorTransaction = Transaction<Schema>;

const FORBIDDEN_MESSAGE = "No tienes acceso a la organización activa";

export const createCustomerArgsSchema = CreateCustomerSchema.extend({
  id: DeleteCustomerSchema.shape.id,
});

export const updateCustomerArgsSchema = UpdateCustomerSchema;
export const deleteCustomerArgsSchema = DeleteCustomerSchema;

function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function assertZeroContext(ctx: ZeroContext | undefined) {
  if (!ctx) {
    throw new Error(FORBIDDEN_MESSAGE);
  }

  return ctx;
}

async function assertUniqueDocumentNumber({
  documentNumber,
  excludeCustomerId,
  organizationId,
  tx,
}: {
  documentNumber: string | null;
  excludeCustomerId?: string;
  organizationId: string;
  tx: CustomerMutatorTransaction;
}) {
  if (!documentNumber) {
    return;
  }

  let query = zql.customer
    .where("organizationId", organizationId)
    .where("documentNumber", documentNumber)
    .where("deletedAt", "IS", null);

  if (excludeCustomerId) {
    query = query.where("id", "!=", excludeCustomerId);
  }

  const existingCustomers = await tx.run(query.limit(1));
  if (existingCustomers.length > 0) {
    throw new Error("Ya existe un cliente activo con ese documento");
  }
}

async function assertActiveCustomer({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: CustomerMutatorTransaction;
}) {
  const existingCustomers = await tx.run(
    zql.customer
      .where("id", id)
      .where("organizationId", organizationId)
      .where("deletedAt", "IS", null)
      .limit(1)
  );

  if (existingCustomers.length === 0) {
    throw new Error(
      "El cliente no existe o ya fue eliminado en la organización actual"
    );
  }
}

export const mutators = defineMutators({
  customers: {
    create: defineMutator(
      createCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        const documentNumber = normalizeOptionalString(args.documentNumber);
        await assertUniqueDocumentNumber({
          documentNumber,
          organizationId: zeroContext.orgID,
          tx,
        });

        const now = Date.now();
        await tx.mutate.customer.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          type: normalizeOptionalString(args.type) ?? "natural",
          documentType: normalizeOptionalString(args.documentType),
          documentNumber,
          name: args.name.trim(),
          email: normalizeOptionalString(args.email),
          phone: normalizeOptionalString(args.phone),
          address: normalizeOptionalString(args.address),
          city: normalizeOptionalString(args.city),
          taxRegime: normalizeOptionalString(args.taxRegime),
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    ),
    update: defineMutator(
      updateCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        const documentNumber =
          args.documentNumber === undefined
            ? undefined
            : normalizeOptionalString(args.documentNumber);

        await assertActiveCustomer({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        if (documentNumber !== undefined) {
          await assertUniqueDocumentNumber({
            documentNumber,
            excludeCustomerId: args.id,
            organizationId: zeroContext.orgID,
            tx,
          });
        }

        await tx.mutate.customer.update({
          id: args.id,
          type:
            args.type === undefined
              ? undefined
              : (normalizeOptionalString(args.type) ?? "natural"),
          documentType:
            args.documentType === undefined
              ? undefined
              : normalizeOptionalString(args.documentType),
          documentNumber,
          name: args.name === undefined ? undefined : args.name.trim(),
          email:
            args.email === undefined
              ? undefined
              : normalizeOptionalString(args.email),
          phone:
            args.phone === undefined
              ? undefined
              : normalizeOptionalString(args.phone),
          address:
            args.address === undefined
              ? undefined
              : normalizeOptionalString(args.address),
          city:
            args.city === undefined
              ? undefined
              : normalizeOptionalString(args.city),
          taxRegime:
            args.taxRegime === undefined
              ? undefined
              : normalizeOptionalString(args.taxRegime),
          updatedAt: Date.now(),
        });
      }
    ),
    delete: defineMutator(
      deleteCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertZeroContext(ctx);
        await assertActiveCustomer({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        const now = Date.now();
        await tx.mutate.customer.update({
          id: args.id,
          deletedAt: now,
          updatedAt: now,
        });
      }
    ),
  },
});

export type Mutators = typeof mutators;
