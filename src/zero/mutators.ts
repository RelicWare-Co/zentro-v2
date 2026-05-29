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
import type { z } from "zod";
import { z as zod } from "zod";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import {
  buildExpectedAmountsByMethod,
  normalizeNumber,
} from "@/features/shifts/shifts.shared";
import {
  CreateCustomerSchema,
  DeleteCustomerSchema,
  UpdateCustomerSchema,
} from "@/schemas/customers";
import { SetModuleEntitlementSchema } from "@/schemas/modules";
import {
  CancelInvitationSchema,
  DeleteOrganizationSchema,
  InviteMemberSchema,
  JoinTokenSchema,
  LeaveOrganizationSchema,
  RemoveMemberSchema,
  RevokeJoinLinkSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "@/schemas/organization";
import { ToggleProductFavoriteInputSchema } from "@/schemas/pos";
import {
  CreateCategorySchema,
  CreateProductSchema,
  DeleteCategorySchema,
  DeleteProductSchema,
  RegisterInventoryMovementSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
} from "@/schemas/products";
import { CancelSaleInputSchema, CreateSaleInputSchema } from "@/schemas/sales";
import { UpdateSettingsSchema } from "@/schemas/settings";
import "./context";
import { type Schema, type ZeroContext, zql } from "./schema";

type ZeroMutatorTransaction = Transaction<Schema>;

interface ProductUpdatePatch {
  barcode?: string | null;
  categoryId?: string | null;
  cost?: number;
  isModifier?: boolean;
  minStock?: number | null;
  name?: string;
  price?: number;
  reorderQuantity?: number | null;
  sku?: string | null;
  stock?: number;
  taxRate?: number;
  trackInventory?: boolean;
}

const FORBIDDEN_MESSAGE = "No tienes acceso a la organización activa";

export const createCustomerArgsSchema = CreateCustomerSchema.extend({
  id: DeleteCustomerSchema.shape.id,
});

export const updateCustomerArgsSchema = UpdateCustomerSchema;
export const deleteCustomerArgsSchema = DeleteCustomerSchema;

export const createProductArgsSchema = CreateProductSchema.extend({
  id: DeleteProductSchema.shape.id,
});
export const updateProductArgsSchema = UpdateProductSchema;
export const deleteProductArgsSchema = DeleteProductSchema;
export const registerInventoryMovementArgsSchema =
  RegisterInventoryMovementSchema.extend({
    id: DeleteProductSchema.shape.id,
  });
export const createCategoryArgsSchema = CreateCategorySchema.extend({
  id: DeleteCategorySchema.shape.id,
});
export const updateCategoryArgsSchema = UpdateCategorySchema;
export const deleteCategoryArgsSchema = DeleteCategorySchema;
export const toggleProductFavoriteArgsSchema = ToggleProductFavoriteInputSchema;
export const registerCreditPaymentArgsSchema = zod.object({
  shiftId: zod.string().trim().min(1),
  creditAccountId: zod.string().trim().min(1),
  saleId: zod.string().trim().optional().nullable(),
  amount: zod.number().int().positive(),
  method: zod.string().trim().min(1),
  reference: zod.string().trim().optional().nullable(),
  notes: zod.string().trim().optional().nullable(),
  createdAt: zod.number().int().min(0).optional(),
  paymentId: zod.string().trim().min(1),
  transactionId: zod.string().trim().min(1),
});

export const createSaleArgsSchema = CreateSaleInputSchema.extend({
  saleId: zod.string().trim().min(1),
});

export const cancelSaleArgsSchema = CancelSaleInputSchema;

export const updateOrganizationSettingsArgsSchema = UpdateSettingsSchema;

export const createJoinLinkArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  token: zod.string().trim().min(1).max(255),
  label: zod.string().trim().max(80).optional(),
  expiresInDays: zod.number().int().min(1).max(90),
});
export const revokeJoinLinkArgsSchema = RevokeJoinLinkSchema;
export const inviteMemberArgsSchema = InviteMemberSchema;
export const cancelInvitationArgsSchema = CancelInvitationSchema;
export const updateMemberRoleArgsSchema = UpdateMemberRoleSchema;
export const removeMemberArgsSchema = RemoveMemberSchema;
export const leaveOrganizationArgsSchema = LeaveOrganizationSchema;
export const updateOrganizationArgsSchema = UpdateOrganizationSchema;
export const deleteOrganizationArgsSchema = DeleteOrganizationSchema;
export const joinLinkRedeemArgsSchema = JoinTokenSchema;

export const setModuleEntitlementArgsSchema = SetModuleEntitlementSchema;

export const addRestaurantOrderItemArgsSchema = zod.object({
  tableId: zod.string().trim().min(1),
  productId: zod.string().trim().min(1),
  quantity: zod.number().int().positive(),
  notes: zod.string().trim().optional().nullable(),
  modifierProductIds: zod.array(zod.string().trim().min(1)).optional(),
  itemId: zod.string().trim().min(1),
});
export const updateRestaurantOrderMetaArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  guestCount: zod.number().int().min(0).optional(),
  notes: zod.string().trim().optional().nullable(),
});
export const updateRestaurantDraftItemArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
  quantity: zod.number().int().positive(),
  notes: zod.string().trim().optional().nullable(),
});
export const deleteRestaurantDraftItemArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
});
export const sendRestaurantOrderToKitchenArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  ticketId: zod.string().trim().min(1),
});
export const updateRestaurantOrderItemStatusArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
  status: zod.enum(["ready", "served"]),
});
export const closeRestaurantOrderArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  shiftId: zod.string().trim().min(1),
  customerId: zod.string().trim().optional().nullable(),
  payments: zod
    .array(
      zod.object({
        method: zod.string().trim().min(1),
        amount: zod.number().int().positive(),
        reference: zod.string().trim().optional().nullable(),
      })
    )
    .min(1),
});
export const createRestaurantAreaArgsSchema = zod.object({
  name: zod.string().trim().min(1).max(60),
});
export const updateRestaurantAreaArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  name: zod.string().trim().min(1).max(60).optional(),
});
export const deleteRestaurantAreaArgsSchema = zod.object({
  id: zod.string().trim().min(1),
});
export const createRestaurantTableArgsSchema = zod.object({
  areaId: zod.string().trim().min(1),
  name: zod.string().trim().min(1).max(40),
  seats: zod.number().int().min(0).max(50).optional(),
});
export const updateRestaurantTableArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  areaId: zod.string().trim().min(1).optional(),
  name: zod.string().trim().min(1).max(40).optional(),
  seats: zod.number().int().min(0).max(50).optional(),
  isActive: zod.boolean().optional(),
});
export const deleteRestaurantTableArgsSchema = zod.object({
  id: zod.string().trim().min(1),
});

export const openShiftArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  startingCash: zod.number().min(0),
  terminalId: zod.string().trim().optional().nullable(),
  terminalName: zod.string().trim().optional().nullable(),
  notes: zod.string().trim().optional().nullable(),
  openedAt: zod.number().int().min(0).optional(),
});
export const closeShiftArgsSchema = zod.object({
  shiftId: zod.string().trim().min(1),
  closures: zod
    .array(
      zod.object({
        paymentMethod: zod.string().trim().min(1),
        actualAmount: zod.number().int().min(0),
      })
    )
    .min(1),
  notes: zod.string().trim().optional().nullable(),
  closedAt: zod.number().int().min(0).optional(),
});
export const registerCashMovementArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  shiftId: zod.string().trim().min(1),
  type: zod.enum(["expense", "payout", "inflow"]),
  paymentMethod: zod.string().trim().min(1),
  amount: zod.number().int().positive(),
  description: zod.string().trim().min(1),
  createdAt: zod.number().int().min(0).optional(),
});

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

function assertOrgZeroContext(
  ctx: ZeroContext | undefined
): ZeroContext & { orgID: string } {
  const zeroContext = assertZeroContext(ctx);
  if (!zeroContext.orgID) {
    throw new Error(FORBIDDEN_MESSAGE);
  }

  return zeroContext as ZeroContext & { orgID: string };
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

function toInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`El campo "${fieldName}" debe ser un número válido`);
  }
  return Math.round(value);
}

function resolveTimestamp(input?: number) {
  if (input === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new Error("La fecha indicada no es válida");
  }

  return Math.round(input);
}

function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
  }
  return normalized;
}

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }
  return normalized;
}

async function getOrganizationSettingsFromTx({
  organizationId,
  tx,
}: {
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const organizationRows = await tx.run(
    zql.organization.where("id", organizationId).limit(1)
  );
  return parseOrganizationSettingsMetadata(organizationRows[0]?.metadata);
}

async function assertCategoryFromOrganization({
  categoryId,
  organizationId,
  tx,
}: {
  categoryId?: string | null;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const normalizedCategoryId = normalizeOptionalString(categoryId);
  if (!normalizedCategoryId) {
    return null;
  }

  const existingCategories = await tx.run(
    zql.category
      .where("id", normalizedCategoryId)
      .where("organizationId", organizationId)
      .limit(1)
  );

  if (existingCategories.length === 0) {
    throw new Error(
      "La categoría seleccionada no existe en la organización actual"
    );
  }

  return normalizedCategoryId;
}

async function assertActiveProduct({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const existingProducts = await tx.run(
    zql.product
      .where("id", id)
      .where("organizationId", organizationId)
      .where("deletedAt", "IS", null)
      .limit(1)
  );

  const existingProduct = existingProducts[0];
  if (!existingProduct) {
    throw new Error(
      "El producto no existe o ya fue eliminado en la organización actual"
    );
  }

  return existingProduct;
}

async function assertActiveCategory({
  id,
  organizationId,
  tx,
}: {
  id: string;
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const existingCategories = await tx.run(
    zql.category
      .where("id", id)
      .where("organizationId", organizationId)
      .limit(1)
  );

  if (existingCategories.length === 0) {
    throw new Error("La categoría no existe en la organización actual");
  }
}

function buildProductUpdatePatch(
  args: z.infer<typeof updateProductArgsSchema>
) {
  const updates: ProductUpdatePatch = {};

  if (args.name !== undefined) {
    const normalizedName = args.name.trim();
    if (!normalizedName) {
      throw new Error("El nombre del producto es obligatorio");
    }
    updates.name = normalizedName;
  }
  if (args.sku !== undefined) {
    updates.sku = normalizeOptionalString(args.sku);
  }
  if (args.barcode !== undefined) {
    updates.barcode = normalizeOptionalString(args.barcode);
  }
  if (args.price !== undefined) {
    updates.price = toNonNegativeInteger(args.price, "price");
  }
  if (args.cost !== undefined) {
    updates.cost = toNonNegativeInteger(args.cost, "cost");
  }
  if (args.taxRate !== undefined) {
    updates.taxRate = toNonNegativeInteger(args.taxRate, "taxRate");
  }
  if (args.stock !== undefined) {
    updates.stock = toNonNegativeInteger(args.stock, "stock");
  }
  if (args.minStock !== undefined) {
    updates.minStock =
      args.minStock === null
        ? null
        : toNonNegativeInteger(args.minStock, "minStock");
  }
  if (args.reorderQuantity !== undefined) {
    updates.reorderQuantity =
      args.reorderQuantity === null
        ? null
        : toNonNegativeInteger(args.reorderQuantity, "reorderQuantity");
  }
  if (args.trackInventory !== undefined) {
    updates.trackInventory = args.trackInventory;
  }
  if (args.isModifier !== undefined) {
    updates.isModifier = args.isModifier;
  }

  return updates;
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

export async function runCloseShiftServerMutator({
  args,
  ctx,
  tx,
}: {
  args: z.infer<typeof closeShiftArgsSchema>;
  ctx: ZeroContext | undefined;
  tx: ZeroMutatorTransaction;
}) {
  const zeroContext = assertOrgZeroContext(ctx);
  const closedAt = resolveTimestamp(args.closedAt);
  const notes = normalizeOptionalString(args.notes);
  const actualByMethod = new Map<string, number>();

  for (const closure of args.closures) {
    const paymentMethod = normalizeRequiredString(
      closure.paymentMethod,
      "paymentMethod"
    ).toLowerCase();
    if (actualByMethod.has(paymentMethod)) {
      throw new Error(`Método de pago duplicado en cierre: ${paymentMethod}`);
    }
    actualByMethod.set(
      paymentMethod,
      toNonNegativeInteger(
        closure.actualAmount,
        `actualAmount (${paymentMethod})`
      )
    );
  }

  const targetShifts = await tx.run(
    zql.shift
      .where("id", args.shiftId)
      .where("organizationId", zeroContext.orgID)
      .limit(1)
  );
  const targetShift = targetShifts[0];
  if (!targetShift) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  if (targetShift.status !== "open") {
    throw new Error("El turno ya está cerrado");
  }
  if (targetShift.userId !== zeroContext.id) {
    throw new Error("Solo el cajero del turno puede cerrar caja");
  }

  const existingClosures = await tx.run(
    zql.shiftClosure.where("shiftId", args.shiftId).limit(1)
  );
  if (existingClosures.length > 0) {
    throw new Error("El turno ya cuenta con un cierre registrado");
  }

  const shiftRows = await tx.run(
    zql.shift
      .where("id", args.shiftId)
      .where("organizationId", zeroContext.orgID)
      .related("payments", (query) => query.related("sale"))
      .related("cashMovements")
      .limit(1)
  );
  const shiftRow = shiftRows[0];
  if (!shiftRow) {
    throw new Error("Turno no encontrado para la organización activa");
  }

  const registeredPayments = (shiftRow.payments ?? [])
    .filter(
      (paymentRow) =>
        !paymentRow.saleId || paymentRow.sale?.status !== "cancelled"
    )
    .map((paymentRow) => ({
      method: paymentRow.method,
      amount: paymentRow.amount,
      saleId: paymentRow.saleId,
      saleTotalAmount: paymentRow.sale?.totalAmount ?? null,
    }));
  const registeredMovements = (shiftRow.cashMovements ?? []).map(
    (movementRow) => ({
      type: movementRow.type,
      paymentMethod: movementRow.paymentMethod ?? "cash",
      amount: movementRow.amount,
    })
  );
  const expectedByMethod = buildExpectedAmountsByMethod(
    normalizeNumber(targetShift.startingCash),
    registeredPayments,
    registeredMovements
  );

  const allMethods = new Set<string>([
    ...expectedByMethod.keys(),
    ...actualByMethod.keys(),
  ]);
  if (allMethods.size === 0) {
    allMethods.add("cash");
  }

  for (const paymentMethod of allMethods) {
    const expectedAmount = expectedByMethod.get(paymentMethod) ?? 0;
    const actualAmount = actualByMethod.get(paymentMethod) ?? 0;
    await tx.mutate.shiftClosure.insert({
      id: crypto.randomUUID(),
      shiftId: args.shiftId,
      paymentMethod,
      expectedAmount,
      actualAmount,
      difference: actualAmount - expectedAmount,
    });
  }

  await tx.mutate.shift.update({
    id: args.shiftId,
    status: "closed",
    closedAt,
    notes: notes ?? targetShift.notes,
  });
}

export const mutators = defineMutators({
  customers: {
    create: defineMutator(
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
    update: defineMutator(
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
    delete: defineMutator(
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
  products: {
    create: defineMutator(
      createProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const normalizedName = args.name.trim();
        if (!normalizedName) {
          throw new Error("El nombre del producto es obligatorio");
        }

        const categoryId = await assertCategoryFromOrganization({
          categoryId: args.categoryId,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.product.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          categoryId,
          name: normalizedName,
          sku: normalizeOptionalString(args.sku),
          barcode: normalizeOptionalString(args.barcode),
          price: toNonNegativeInteger(args.price, "price"),
          cost: toNonNegativeInteger(args.cost ?? 0, "cost"),
          taxRate: toNonNegativeInteger(args.taxRate ?? 0, "taxRate"),
          stock: toNonNegativeInteger(args.stock ?? 0, "stock"),
          minStock:
            args.minStock === undefined || args.minStock === null
              ? null
              : toNonNegativeInteger(args.minStock, "minStock"),
          reorderQuantity:
            args.reorderQuantity === undefined || args.reorderQuantity === null
              ? null
              : toNonNegativeInteger(args.reorderQuantity, "reorderQuantity"),
          trackInventory: args.trackInventory ?? true,
          isModifier: args.isModifier ?? false,
          isFavorite: false,
          deletedAt: null,
          createdAt: Date.now(),
        });
      }
    ),
    update: defineMutator(
      updateProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveProduct({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        const updates = buildProductUpdatePatch(args);
        if (args.categoryId !== undefined) {
          updates.categoryId = await assertCategoryFromOrganization({
            categoryId: args.categoryId,
            organizationId: zeroContext.orgID,
            tx,
          });
        }

        await tx.mutate.product.update({
          id: args.id,
          ...updates,
        });
      }
    ),
    delete: defineMutator(
      deleteProductArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveProduct({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.product.update({
          id: args.id,
          deletedAt: Date.now(),
        });
      }
    ),
    toggleFavorite: defineMutator(
      toggleProductFavoriteArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const targetProduct = await assertActiveProduct({
          id: args.productId,
          organizationId: zeroContext.orgID,
          tx,
        });
        const nextIsFavorite = !targetProduct.isFavorite;

        await tx.mutate.product.update({
          id: args.productId,
          isFavorite: nextIsFavorite,
        });
      }
    ),
    registerInventoryMovement: defineMutator(
      registerInventoryMovementArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const baseQuantity = toInteger(args.quantity, "quantity");
        if (baseQuantity === 0) {
          throw new Error("La cantidad debe ser diferente de 0");
        }

        let deltaQuantity = baseQuantity;
        const normalizedRestockMode = args.restockMode ?? "add_to_stock";
        if (args.type === "restock" && baseQuantity < 0) {
          throw new Error("La reposición debe tener una cantidad positiva");
        }
        if (args.type === "waste") {
          deltaQuantity = -Math.abs(baseQuantity);
        }

        const targetProduct = await assertActiveProduct({
          id: args.productId,
          organizationId: zeroContext.orgID,
          tx,
        });

        if (!targetProduct.trackInventory) {
          throw new Error(
            "No puedes registrar movimientos en un producto sin control de inventario"
          );
        }

        const currentStock = targetProduct.stock ?? 0;
        if (
          args.type === "restock" &&
          normalizedRestockMode === "set_as_total"
        ) {
          deltaQuantity = baseQuantity - currentStock;
        }

        const nextStock = currentStock + deltaQuantity;
        if (nextStock < 0) {
          throw new Error(
            `Stock insuficiente para ${targetProduct.name}. Disponible: ${currentStock}`
          );
        }

        await tx.mutate.product.update({
          id: targetProduct.id,
          stock: nextStock,
        });
        await tx.mutate.inventoryMovement.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          productId: targetProduct.id,
          userId: zeroContext.id,
          type: args.type,
          quantity: deltaQuantity,
          notes: normalizeOptionalString(args.notes),
          createdAt: resolveTimestamp(args.createdAt),
        });
      }
    ),
    createCategory: defineMutator(
      createCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const normalizedName = args.name.trim();
        if (!normalizedName) {
          throw new Error("El nombre de la categoría es obligatorio");
        }

        await tx.mutate.category.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          name: normalizedName,
          description: normalizeOptionalString(args.description),
          createdAt: Date.now(),
        });
      }
    ),
    updateCategory: defineMutator(
      updateCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveCategory({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.category.update({
          id: args.id,
          name: args.name === undefined ? undefined : args.name.trim(),
          description:
            args.description === undefined
              ? undefined
              : normalizeOptionalString(args.description),
        });
      }
    ),
    deleteCategory: defineMutator(
      deleteCategoryArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        await assertActiveCategory({
          id: args.id,
          organizationId: zeroContext.orgID,
          tx,
        });

        await tx.mutate.category.delete({ id: args.id });
      }
    ),
  },
  credit: {
    registerPayment: defineMutator(
      registerCreditPaymentArgsSchema,
      async () => {
        // Server-only transaction; client completes without optimistic writes.
      }
    ),
  },
  sales: {
    create: defineMutator(createSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
    cancel: defineMutator(cancelSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
  },
  organization: {
    updateSettings: defineMutator(
      updateOrganizationSettingsArgsSchema,
      async () => {
        // Server-only validation; client completes without optimistic writes.
      }
    ),
    joinLinkCreate: defineMutator(createJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    joinLinkRevoke: defineMutator(revokeJoinLinkArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    inviteMember: defineMutator(inviteMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    cancelInvitation: defineMutator(cancelInvitationArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    updateMemberRole: defineMutator(updateMemberRoleArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    removeMember: defineMutator(removeMemberArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    leaveOrganization: defineMutator(leaveOrganizationArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
    updateOrganization: defineMutator(
      updateOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    deleteOrganization: defineMutator(
      deleteOrganizationArgsSchema,
      async () => {
        // Server-only organization writes; client completes without optimistic writes.
      }
    ),
    joinLinkRedeem: defineMutator(joinLinkRedeemArgsSchema, async () => {
      // Server-only organization writes; client completes without optimistic writes.
    }),
  },
  modules: {
    setEntitlement: defineMutator(setModuleEntitlementArgsSchema, async () => {
      // Server-only entitlement writes; client completes without optimistic writes.
    }),
  },
  restaurants: {
    addOrderItem: defineMutator(addRestaurantOrderItemArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    updateOrderMeta: defineMutator(
      updateRestaurantOrderMetaArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateDraftItem: defineMutator(
      updateRestaurantDraftItemArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    deleteDraftItem: defineMutator(
      deleteRestaurantDraftItemArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    sendToKitchen: defineMutator(
      sendRestaurantOrderToKitchenArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateItemStatus: defineMutator(
      updateRestaurantOrderItemStatusArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    closeOrder: defineMutator(closeRestaurantOrderArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    createArea: defineMutator(createRestaurantAreaArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    updateArea: defineMutator(updateRestaurantAreaArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    deleteArea: defineMutator(deleteRestaurantAreaArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    createTable: defineMutator(createRestaurantTableArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    updateTable: defineMutator(updateRestaurantTableArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
    deleteTable: defineMutator(deleteRestaurantTableArgsSchema, async () => {
      // Server-only restaurant writes; client completes without optimistic writes.
    }),
  },
  shifts: {
    open: defineMutator(openShiftArgsSchema, async ({ args, ctx, tx }) => {
      const zeroContext = assertOrgZeroContext(ctx);
      const startingCash = toNonNegativeInteger(
        args.startingCash,
        "startingCash"
      );
      const terminalId = normalizeOptionalString(args.terminalId);
      const notes = normalizeOptionalString(args.notes);
      const openedAt = resolveTimestamp(args.openedAt);
      const organizationSettings = await getOrganizationSettingsFromTx({
        organizationId: zeroContext.orgID,
        tx,
      });
      const terminalName =
        normalizeOptionalString(args.terminalName) ??
        organizationSettings.pos.defaultTerminalName;

      const userOpenShifts = await tx.run(
        zql.shift
          .where("organizationId", zeroContext.orgID)
          .where("userId", zeroContext.id)
          .where("status", "open")
          .limit(1)
      );
      if (userOpenShifts.length > 0) {
        throw new Error("El usuario ya tiene un turno abierto");
      }

      if (terminalId) {
        const terminalOpenShifts = await tx.run(
          zql.shift
            .where("organizationId", zeroContext.orgID)
            .where("status", "open")
            .where("terminalId", terminalId)
            .limit(1)
        );
        if (terminalOpenShifts.length > 0) {
          throw new Error("La terminal indicada ya tiene un turno abierto");
        }
      }

      await tx.mutate.shift.insert({
        id: args.id,
        organizationId: zeroContext.orgID,
        userId: zeroContext.id,
        terminalId,
        terminalName,
        status: "open",
        startingCash,
        openedAt,
        notes,
      });
    }),
    cashMovement: defineMutator(
      registerCashMovementArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const validTypes = ["expense", "payout", "inflow"] as const;
        if (!validTypes.includes(args.type)) {
          throw new Error("Tipo de movimiento de caja inválido");
        }

        const amount = toPositiveInteger(args.amount, "amount");
        const description = normalizeRequiredString(
          args.description,
          "description"
        );
        const paymentMethod = normalizeRequiredString(
          args.paymentMethod,
          "paymentMethod"
        ).toLowerCase();
        const createdAt = resolveTimestamp(args.createdAt);

        const targetShifts = await tx.run(
          zql.shift
            .where("id", args.shiftId)
            .where("organizationId", zeroContext.orgID)
            .limit(1)
        );
        const targetShift = targetShifts[0];
        if (!targetShift) {
          throw new Error("Turno no encontrado para la organización activa");
        }
        if (targetShift.status !== "open") {
          throw new Error(
            "No se puede registrar movimiento en un turno cerrado"
          );
        }
        if (targetShift.userId !== zeroContext.id) {
          throw new Error(
            "Solo el cajero del turno puede registrar movimientos"
          );
        }

        const organizationSettings = await getOrganizationSettingsFromTx({
          organizationId: zeroContext.orgID,
          tx,
        });
        const enabledPaymentMethodIds = new Set(
          getEnabledPaymentMethods(organizationSettings).map(
            (paymentMethod) => paymentMethod.id
          )
        );
        if (!enabledPaymentMethodIds.has(paymentMethod)) {
          throw new Error(`Método de pago no habilitado: ${paymentMethod}`);
        }

        await tx.mutate.cashMovement.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          shiftId: args.shiftId,
          type: args.type,
          paymentMethod,
          amount,
          description,
          createdAt,
        });
      }
    ),
    close: defineMutator(closeShiftArgsSchema, async () => {
      // Server-only close. The authoritative override runs in
      // `src/zero/mutators.server.ts` so client-side local reads cannot compute
      // a close from an incomplete cached shift graph.
    }),
  },
});

export type Mutators = typeof mutators;
