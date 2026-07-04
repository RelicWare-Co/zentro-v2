import { and, eq, inArray, isNull } from "drizzle-orm";
import { createError } from "evlog";
import type { z } from "zod";
import type { Database, dbSqlite } from "@/database/drizzle/db";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import {
  payment,
  sale,
  saleItem,
  saleItemModifier,
} from "@/database/drizzle/schema/sales.schema";
import { recordCreditSaleCharge } from "@/features/credit/credit-operations.server";
import {
  applyInventoryDeltas,
  saleMovementSource,
} from "@/features/inventory/inventory-operations.server";
import {
  buildPreparedItems,
  type NormalizedPayment,
  normalizeAndValidatePayments,
  type PreparedItem,
  type ProductInfo,
  validatePaymentRules,
  validateReceiptTotals,
} from "@/features/sales/sale-totals.shared";
import type {
  CreateSaleInputSchema,
  CreateSaleResultSchema,
} from "@/features/sales/sales.schema";
import { loadOrganizationSettings } from "@/features/settings/payment-methods.server";
import { getEnabledPaymentMethods } from "@/features/settings/settings.shared";
import { assertOpenCashierShift } from "@/features/shifts/shift-operations.server";
import {
  normalizeOptionalString,
  resolveDate,
  toNonNegativeInteger,
} from "@/lib/domain-values.shared";

export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;
export type CreateSaleResult = z.infer<typeof CreateSaleResultSchema>;
export type CreateSaleInputWithId = CreateSaleInput & { saleId: string };

export type CreateSaleDbExecutor = Pick<
  Database,
  "select" | "insert" | "update"
>;

type RegisteredPayment = NormalizedPayment & {
  appliedAmount: number;
  changeAmount: number;
};

async function validateCustomer(
  tx: CreateSaleDbExecutor,
  customerId: string | null,
  organizationId: string
) {
  if (!customerId) {
    return;
  }
  const [existingCustomer] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        eq(customer.id, customerId),
        eq(customer.organizationId, organizationId),
        isNull(customer.deletedAt)
      )
    )
    .limit(1);
  if (!existingCustomer) {
    throw new Error("El cliente seleccionado no existe o está inactivo");
  }
}

async function loadProducts(
  tx: CreateSaleDbExecutor,
  referencedIds: string[],
  organizationId: string
) {
  if (referencedIds.length === 0) {
    throw new Error("No hay productos válidos para procesar");
  }

  const productRows = await tx
    .select({
      id: product.id,
      name: product.name,
      price: product.price,
      taxRate: product.taxRate,
      isModifier: product.isModifier,
      trackInventory: product.trackInventory,
      stock: product.stock,
    })
    .from(product)
    .where(
      and(
        eq(product.organizationId, organizationId),
        isNull(product.deletedAt),
        inArray(product.id, referencedIds)
      )
    );

  const productById = new Map<string, ProductInfo>(
    productRows.map((row) => [row.id, row])
  );
  for (const productId of referencedIds) {
    if (!productById.has(productId)) {
      throw new Error(
        `Producto no encontrado o inactivo en la organización actual: ${productId}`
      );
    }
  }

  return productById;
}

async function insertSaleRecords(
  tx: CreateSaleDbExecutor,
  saleId: string,
  organizationId: string,
  shiftId: string,
  customerId: string | null,
  userId: string,
  totals: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
  },
  saleStatus: string,
  createdAt: Date,
  preparedItems: PreparedItem[],
  normalizedPayments: RegisteredPayment[]
) {
  await tx.insert(sale).values({
    id: saleId,
    organizationId,
    shiftId,
    customerId,
    userId,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
    status: saleStatus,
    createdAt,
  });

  await tx.insert(saleItem).values(
    preparedItems.map((line) => ({
      id: line.id,
      saleId,
      organizationId,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.subtotal,
      taxRate: line.taxRate,
      taxAmount: line.taxAmount,
      discountAmount: line.discountAmount,
      totalAmount: line.totalAmount,
    }))
  );

  const modifierRows = preparedItems.flatMap((line) => line.modifiers);
  if (modifierRows.length > 0) {
    await tx.insert(saleItemModifier).values(
      modifierRows.map((modifierRow) => ({
        id: modifierRow.id,
        saleItemId: modifierRow.saleItemId,
        organizationId,
        modifierProductId: modifierRow.modifierProductId,
        quantity: modifierRow.quantity,
        unitPrice: modifierRow.unitPrice,
        subtotal: modifierRow.subtotal,
      }))
    );
  }

  if (normalizedPayments.length > 0) {
    await tx.insert(payment).values(
      normalizedPayments.map((registeredPayment) => ({
        id: crypto.randomUUID(),
        organizationId,
        saleId,
        shiftId,
        method: registeredPayment.method,
        reference: registeredPayment.reference,
        amount: registeredPayment.amount,
        appliedAmount: registeredPayment.appliedAmount,
        changeAmount: registeredPayment.changeAmount,
        createdAt,
      }))
    );
  }
}

function applySalePayments(
  normalizedPayments: NormalizedPayment[],
  totalAmount: number
): RegisteredPayment[] {
  const nonCashTenderedAmount = normalizedPayments.reduce(
    (total, registeredPayment) =>
      registeredPayment.method === "cash"
        ? total
        : total + registeredPayment.amount,
    0
  );
  let remainingCashAppliedAmount = Math.max(
    totalAmount - nonCashTenderedAmount,
    0
  );

  return normalizedPayments.map((registeredPayment) => {
    if (registeredPayment.method !== "cash") {
      return {
        ...registeredPayment,
        appliedAmount: registeredPayment.amount,
        changeAmount: 0,
      };
    }

    const appliedAmount = Math.min(
      registeredPayment.amount,
      remainingCashAppliedAmount
    );
    remainingCashAppliedAmount -= appliedAmount;

    return {
      ...registeredPayment,
      appliedAmount,
      changeAmount: registeredPayment.amount - appliedAmount,
    };
  });
}

export async function runCreateSale(
  tx: CreateSaleDbExecutor,
  input: CreateSaleInputWithId,
  ctx: { organizationId: string; userId: string }
): Promise<CreateSaleResult> {
  const { organizationId, userId } = ctx;

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("La venta debe incluir al menos un ítem");
  }

  const createdAt = resolveDate(input.createdAt);
  const customerId = normalizeOptionalString(input.customerId);
  const saleLevelDiscount = toNonNegativeInteger(
    input.discountAmount ?? 0,
    "discountAmount"
  );
  const isCreditSale = input.isCreditSale ?? false;
  const { saleId } = input;

  const [, organizationSettings] = await Promise.all([
    assertOpenCashierShift(tx, {
      shiftId: input.shiftId,
      organizationId,
      userId,
    }),
    loadOrganizationSettings(tx, organizationId),
    validateCustomer(tx, customerId, organizationId),
  ]);

  if (isCreditSale && !organizationSettings.credit.allowCreditSales) {
    throw new Error(
      "Las ventas a crédito no están habilitadas en la organización"
    );
  }

  const enabledPaymentMethodIds = new Set(
    getEnabledPaymentMethods(organizationSettings).map((pm) => pm.id)
  );

  const referencedProductIds = new Set<string>();
  for (const item of input.items) {
    referencedProductIds.add(item.productId);
    for (const modifier of item.modifiers ?? []) {
      referencedProductIds.add(modifier.modifierProductId);
    }
  }

  const productById = await loadProducts(
    tx,
    [...referencedProductIds],
    organizationId
  );

  const {
    preparedItems,
    stockDeltas,
    subtotal,
    taxAmount,
    itemDiscountAmount,
  } = buildPreparedItems(input.items, productById, {
    saleLevelDiscount,
  });

  const discountAmount = itemDiscountAmount;
  const totalAmount = subtotal + taxAmount - discountAmount;
  if (totalAmount < 0) {
    throw new Error("El total de la venta no puede ser negativo");
  }

  validateReceiptTotals(input.receiptTotals, {
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
  });

  const normalizedPayments = normalizeAndValidatePayments(
    input.payments,
    enabledPaymentMethodIds
  );
  validatePaymentRules(
    normalizedPayments,
    totalAmount,
    isCreditSale,
    customerId
  );
  const registeredPayments = applySalePayments(normalizedPayments, totalAmount);

  const saleStatus = isCreditSale ? "credit" : "completed";
  const appliedPaidAmount = registeredPayments.reduce(
    (total, registeredPayment) => total + registeredPayment.appliedAmount,
    0
  );

  await insertSaleRecords(
    tx,
    saleId,
    organizationId,
    input.shiftId,
    customerId,
    userId,
    { subtotal, taxAmount, discountAmount, totalAmount },
    saleStatus,
    createdAt,
    preparedItems,
    registeredPayments
  );

  await applyInventoryDeltas(tx, {
    organizationId,
    userId,
    deltas: stockDeltas,
    products: productById,
    source: saleMovementSource(saleId),
    createdAt,
  });

  const balanceDue = Math.max(totalAmount - appliedPaidAmount, 0);
  if (isCreditSale && customerId) {
    await recordCreditSaleCharge(tx, {
      organizationId,
      customerId,
      balanceDue,
      saleId,
      createdAt,
      creditSettings: organizationSettings.credit,
    });
  }

  return {
    saleId,
    status: saleStatus,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount: appliedPaidAmount,
    balanceDue,
  };
}

function mapCreateSaleError(error: unknown): never {
  if (error instanceof Error) {
    throw createError({ message: error.message, status: 400 });
  }
  throw error;
}

export function createCoreSale(
  input: CreateSaleInput & { saleId?: string },
  ctx: {
    db: ReturnType<typeof dbSqlite>;
    organizationId: string;
    userId: string;
  }
) {
  const { db: txCtx, organizationId, userId } = ctx;
  const saleId = input.saleId ?? crypto.randomUUID();

  return txCtx
    .transaction((tx) =>
      runCreateSale(tx, { ...input, saleId }, { organizationId, userId })
    )
    .catch(mapCreateSaleError);
}
