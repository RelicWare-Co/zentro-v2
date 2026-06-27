import {
  CreateCustomerSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/features/customers/customers.schema";
import { zql } from "@/zero/schema";
import {
  assertOrgZeroContext,
  defineZentroMutator,
  normalizeOptionalString,
  type ZeroMutatorTransaction,
} from "@/zero/sdk";

export const createCustomerArgsSchema = CreateCustomerSchema.extend({
  id: DeleteCustomerSchema.shape.id,
});

export const updateCustomerArgsSchema = UpdateCustomerSchema;
export const deleteCustomerArgsSchema = DeleteCustomerSchema;

async function assertUniqueDocumentNumber({
  documentNumber,
  excludeCustomerId,
  organizationId,
  tx,
}: {
  documentNumber: string | null;
  excludeCustomerId?: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
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
  tx: ZeroMutatorTransaction;
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

export const customersMutators = {
  customers: {
    create: defineZentroMutator(
      createCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
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
    update: defineZentroMutator(
      updateCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
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
    delete: defineZentroMutator(
      deleteCustomerArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
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
};
