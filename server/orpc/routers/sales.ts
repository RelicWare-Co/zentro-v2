import { implement, ORPCError } from "@orpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import { organization, user } from "@/database/drizzle/schema/auth.schema";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import {
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import {
  payment,
  sale,
  saleItem,
  saleItemModifier,
} from "@/database/drizzle/schema/sales.schema";
import {
  buildPaymentMethodOptions,
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import { createCoreSale } from "@/server/sales/create-sale.server";
import type { AppContext } from "../context";
import { salesContract } from "../contracts/sales";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

type DbTransaction = Parameters<
  Parameters<AppContext["db"]["transaction"]>[0]
>[0];

const salesImplementer = implement(salesContract).$context<AppContext>();

const orgRequiredProcedure = salesImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeTimestamp(value: Date | number | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return 0;
}

function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

function resolveAmountRange(
  minimum: number | null | undefined,
  maximum: number | null | undefined
) {
  const normalizedMinimum =
    typeof minimum === "number" && Number.isFinite(minimum) && minimum >= 0
      ? Math.trunc(minimum)
      : null;
  const normalizedMaximum =
    typeof maximum === "number" && Number.isFinite(maximum) && maximum >= 0
      ? Math.trunc(maximum)
      : null;

  if (
    normalizedMinimum !== null &&
    normalizedMaximum !== null &&
    normalizedMinimum > normalizedMaximum
  ) {
    return {
      minimum: normalizedMaximum,
      maximum: normalizedMinimum,
    };
  }

  return {
    minimum: normalizedMinimum,
    maximum: normalizedMaximum,
  };
}

function buildSalesWhereConditions(
  organizationId: string,
  filters: {
    status?: string | null;
    cashierId?: string | null;
    terminalName?: string | null;
    paymentMethod?: string | null;
    balanceStatus?: string | null;
    trimmedSearchQuery?: string;
    startDateMs: number | null;
    endDateExclusiveMs: number | null;
    amountRange: { minimum: number | null; maximum: number | null };
  },
  paidAmountExpression: SQL<number>
) {
  const baseWhereConditions = [eq(sale.organizationId, organizationId)];
  if (filters.status) {
    baseWhereConditions.push(eq(sale.status, filters.status));
  }
  if (filters.cashierId) {
    baseWhereConditions.push(eq(sale.userId, filters.cashierId));
  }
  if (filters.terminalName) {
    baseWhereConditions.push(eq(shift.terminalName, filters.terminalName));
  }
  if (filters.startDateMs !== null) {
    baseWhereConditions.push(
      gte(sale.createdAt, new Date(filters.startDateMs))
    );
  }
  if (filters.endDateExclusiveMs !== null) {
    baseWhereConditions.push(
      lt(sale.createdAt, new Date(filters.endDateExclusiveMs))
    );
  }
  if (filters.amountRange.minimum !== null) {
    baseWhereConditions.push(
      gte(sale.totalAmount, filters.amountRange.minimum)
    );
  }
  if (filters.amountRange.maximum !== null) {
    baseWhereConditions.push(
      sql`${sale.totalAmount} <= ${filters.amountRange.maximum}`
    );
  }
  if (filters.paymentMethod) {
    baseWhereConditions.push(sql`exists (
			select 1
			from ${payment}
			where ${payment.organizationId} = ${organizationId}
				and ${payment.saleId} = ${sale.id}
				and ${payment.method} = ${filters.paymentMethod}
		)`);
  }
  if (filters.balanceStatus === "with_balance") {
    baseWhereConditions.push(
      sql`${sale.status} <> 'cancelled' and ${paidAmountExpression} < ${sale.totalAmount}`
    );
  }
  if (filters.balanceStatus === "settled") {
    baseWhereConditions.push(
      sql`(${sale.status} = 'cancelled' or ${paidAmountExpression} >= ${sale.totalAmount})`
    );
  }

  const searchCondition = filters.trimmedSearchQuery
    ? sql`(
			${sale.id} like ${`%${filters.trimmedSearchQuery}%`}
			or coalesce(${customer.name}, '') like ${`%${filters.trimmedSearchQuery}%`}
			or coalesce(${user.name}, '') like ${`%${filters.trimmedSearchQuery}%`}
			or coalesce(${shift.terminalName}, '') like ${`%${filters.trimmedSearchQuery}%`}
		)`
    : null;

  return searchCondition
    ? [...baseWhereConditions, searchCondition]
    : baseWhereConditions;
}

export const list = orgRequiredProcedure.list.handler(
  async ({ input, context }) => {
    const organizationId = context.organizationId;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const cursor = Math.max(input.cursor ?? 0, 0);
    const trimmedSearchQuery = input.searchQuery?.trim();
    const startDateMs = parseDateBoundary(input.startDate);
    const endDateMs = parseDateBoundary(input.endDate);
    const amountRange = resolveAmountRange(input.amountMin, input.amountMax);
    const endDateExclusiveMs =
      endDateMs === null ? null : endDateMs + 24 * 60 * 60 * 1000;

    const paidAmountExpression = sql<number>`coalesce((
			select sum(${payment.amount})
			from ${payment}
			where ${payment.organizationId} = ${organizationId}
				and ${payment.saleId} = ${sale.id}
		), 0)`;

    const salesWhereConditions = buildSalesWhereConditions(
      organizationId,
      {
        status: input.status,
        cashierId: input.cashierId,
        terminalName: input.terminalName,
        paymentMethod: input.paymentMethod,
        balanceStatus: input.balanceStatus,
        trimmedSearchQuery,
        startDateMs,
        endDateExclusiveMs,
        amountRange,
      },
      paidAmountExpression
    );

    const [
      salesRows,
      totalRows,
      cashierRows,
      terminalRows,
      paymentMethodRows,
      organizationRows,
    ] = await Promise.all([
      context.db
        .select({
          id: sale.id,
          totalAmount: sale.totalAmount,
          status: sale.status,
          createdAt: sale.createdAt,
          customerName: customer.name,
          cashierName: user.name,
          terminalName: shift.terminalName,
        })
        .from(sale)
        .leftJoin(
          customer,
          and(
            eq(customer.id, sale.customerId),
            eq(customer.organizationId, organizationId)
          )
        )
        .leftJoin(user, eq(user.id, sale.userId))
        .leftJoin(
          shift,
          and(
            eq(shift.id, sale.shiftId),
            eq(shift.organizationId, organizationId)
          )
        )
        .where(and(...salesWhereConditions))
        .orderBy(desc(sale.createdAt), desc(sale.id))
        .limit(limit + 1)
        .offset(cursor),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(sale)
        .leftJoin(
          customer,
          and(
            eq(customer.id, sale.customerId),
            eq(customer.organizationId, organizationId)
          )
        )
        .leftJoin(user, eq(user.id, sale.userId))
        .leftJoin(
          shift,
          and(
            eq(shift.id, sale.shiftId),
            eq(shift.organizationId, organizationId)
          )
        )
        .where(and(...salesWhereConditions)),
      context.db
        .selectDistinct({
          id: user.id,
          name: user.name,
        })
        .from(sale)
        .innerJoin(user, eq(user.id, sale.userId))
        .where(eq(sale.organizationId, organizationId))
        .orderBy(asc(user.name)),
      context.db
        .selectDistinct({
          name: shift.terminalName,
        })
        .from(sale)
        .innerJoin(
          shift,
          and(
            eq(shift.id, sale.shiftId),
            eq(shift.organizationId, organizationId)
          )
        )
        .where(
          and(
            eq(sale.organizationId, organizationId),
            sql`${shift.terminalName} is not null`
          )
        )
        .orderBy(asc(shift.terminalName)),
      context.db
        .selectDistinct({
          method: payment.method,
        })
        .from(payment)
        .where(eq(payment.organizationId, organizationId))
        .orderBy(asc(payment.method)),
      context.db
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
    ]);

    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    const paymentMethods = buildPaymentMethodOptions(
      getAllPaymentMethods(organizationSettings),
      paymentMethodRows.map((pm) => pm.method)
    );

    const pageRows = salesRows.slice(0, limit);
    const hasMore = salesRows.length > limit;
    const nextCursor = salesRows.length > limit ? cursor + limit : null;
    const saleIds = pageRows.map((row) => row.id);

    if (saleIds.length === 0) {
      return {
        data: [],
        total: normalizeNumber(totalRows[0]?.total),
        hasMore,
        nextCursor,
        filterOptions: {
          cashiers: cashierRows,
          terminals: terminalRows.reduce<string[]>((acc, t) => {
            if (t.name) {
              acc.push(t.name);
            }
            return acc;
          }, []),
          paymentMethods,
        },
      };
    }

    const [paymentRows, saleItemRows] = await Promise.all([
      context.db
        .select({
          saleId: payment.saleId,
          method: payment.method,
          amount: payment.amount,
        })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, organizationId),
            inArray(payment.saleId, saleIds)
          )
        ),
      context.db
        .select({
          saleId: saleItem.saleId,
          itemCount: sql<number>`coalesce(sum(${saleItem.quantity}), 0)`,
        })
        .from(saleItem)
        .where(
          and(
            eq(saleItem.organizationId, organizationId),
            inArray(saleItem.saleId, saleIds)
          )
        )
        .groupBy(saleItem.saleId),
    ]);

    const paymentsBySaleId = new Map<
      string,
      { paidAmount: number; paymentMethods: Set<string> }
    >();
    for (const paymentRow of paymentRows) {
      if (!paymentRow.saleId) {
        continue;
      }
      const current = paymentsBySaleId.get(paymentRow.saleId) ?? {
        paidAmount: 0,
        paymentMethods: new Set(),
      };
      current.paidAmount += normalizeNumber(paymentRow.amount);
      current.paymentMethods.add(paymentRow.method);
      paymentsBySaleId.set(paymentRow.saleId, current);
    }

    const itemCountBySaleId = new Map<string, number>();
    for (const saleItemRow of saleItemRows) {
      itemCountBySaleId.set(
        saleItemRow.saleId,
        normalizeNumber(saleItemRow.itemCount)
      );
    }

    return {
      data: pageRows.map((row) => {
        const paymentSummary = paymentsBySaleId.get(row.id);
        const totalAmount = normalizeNumber(row.totalAmount);
        const paidAmount =
          row.status === "cancelled" ? 0 : (paymentSummary?.paidAmount ?? 0);

        return {
          id: row.id,
          totalAmount,
          status: row.status,
          customerName: row.customerName,
          cashierName: row.cashierName,
          terminalName: row.terminalName,
          createdAt: normalizeTimestamp(row.createdAt),
          itemCount: itemCountBySaleId.get(row.id) ?? 0,
          paidAmount,
          balanceDue:
            row.status === "cancelled"
              ? 0
              : Math.max(totalAmount - paidAmount, 0),
          paymentMethods: paymentSummary?.paymentMethods
            ? [...paymentSummary.paymentMethods]
            : [],
        };
      }),
      total: normalizeNumber(totalRows[0]?.total),
      hasMore,
      nextCursor,
      filterOptions: {
        cashiers: cashierRows,
        terminals: terminalRows.reduce<string[]>((acc, t) => {
          if (t.name) {
            acc.push(t.name);
          }
          return acc;
        }, []),
        paymentMethods,
      },
    };
  }
);

export const detail = orgRequiredProcedure.detail.handler(
  async ({ input, context }) => {
    const organizationId = context.organizationId;

    const saleRows = await context.db
      .select({
        id: sale.id,
        status: sale.status,
        createdAt: sale.createdAt,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        discountAmount: sale.discountAmount,
        totalAmount: sale.totalAmount,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerDocumentType: customer.documentType,
        customerDocumentNumber: customer.documentNumber,
        cashierId: user.id,
        cashierName: user.name,
        cashierEmail: user.email,
        shiftId: shift.id,
        terminalName: shift.terminalName,
      })
      .from(sale)
      .leftJoin(
        customer,
        and(
          eq(customer.id, sale.customerId),
          eq(customer.organizationId, organizationId)
        )
      )
      .leftJoin(user, eq(user.id, sale.userId))
      .leftJoin(
        shift,
        and(
          eq(shift.id, sale.shiftId),
          eq(shift.organizationId, organizationId)
        )
      )
      .where(
        and(eq(sale.id, input.saleId), eq(sale.organizationId, organizationId))
      )
      .limit(1);

    const saleRow = saleRows[0];
    if (!saleRow) {
      return null;
    }

    const [paymentRows, itemRows] = await Promise.all([
      context.db
        .select({
          id: payment.id,
          method: payment.method,
          reference: payment.reference,
          amount: payment.amount,
          createdAt: payment.createdAt,
          creditTransactionType: creditTransaction.type,
          creditTransactionNotes: creditTransaction.notes,
        })
        .from(payment)
        .leftJoin(
          creditTransaction,
          and(
            eq(creditTransaction.paymentId, payment.id),
            eq(creditTransaction.organizationId, organizationId)
          )
        )
        .where(
          and(
            eq(payment.organizationId, organizationId),
            eq(payment.saleId, saleRow.id)
          )
        )
        .orderBy(desc(payment.createdAt), desc(payment.id)),
      context.db
        .select({
          id: saleItem.id,
          productId: saleItem.productId,
          productName: product.name,
          quantity: saleItem.quantity,
          unitPrice: saleItem.unitPrice,
          subtotal: saleItem.subtotal,
          taxRate: saleItem.taxRate,
          taxAmount: saleItem.taxAmount,
          discountAmount: saleItem.discountAmount,
          totalAmount: saleItem.totalAmount,
        })
        .from(saleItem)
        .innerJoin(
          product,
          and(
            eq(product.id, saleItem.productId),
            eq(product.organizationId, organizationId)
          )
        )
        .where(
          and(
            eq(saleItem.organizationId, organizationId),
            eq(saleItem.saleId, saleRow.id)
          )
        )
        .orderBy(desc(saleItem.id)),
    ]);

    const saleItemIds = itemRows.map((row) => row.id);
    const modifierRows =
      saleItemIds.length > 0
        ? await context.db
            .select({
              id: saleItemModifier.id,
              saleItemId: saleItemModifier.saleItemId,
              modifierProductId: saleItemModifier.modifierProductId,
              modifierName: product.name,
              quantity: saleItemModifier.quantity,
              unitPrice: saleItemModifier.unitPrice,
              subtotal: saleItemModifier.subtotal,
            })
            .from(saleItemModifier)
            .innerJoin(
              product,
              and(
                eq(product.id, saleItemModifier.modifierProductId),
                eq(product.organizationId, organizationId)
              )
            )
            .where(
              and(
                eq(saleItemModifier.organizationId, organizationId),
                inArray(saleItemModifier.saleItemId, saleItemIds)
              )
            )
        : [];

    const modifiersBySaleItemId = new Map<
      string,
      Array<{
        id: string;
        modifierProductId: string;
        name: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>
    >();
    for (const modifierRow of modifierRows) {
      const current = modifiersBySaleItemId.get(modifierRow.saleItemId) ?? [];
      current.push({
        id: modifierRow.id,
        modifierProductId: modifierRow.modifierProductId,
        name: modifierRow.modifierName,
        quantity: normalizeNumber(modifierRow.quantity),
        unitPrice: normalizeNumber(modifierRow.unitPrice),
        subtotal: normalizeNumber(modifierRow.subtotal),
      });
      modifiersBySaleItemId.set(modifierRow.saleItemId, current);
    }

    const payments = paymentRows.map((paymentRow) => ({
      id: paymentRow.id,
      method: paymentRow.method,
      reference: paymentRow.reference,
      amount: normalizeNumber(paymentRow.amount),
      createdAt: normalizeTimestamp(paymentRow.createdAt),
      kind: (paymentRow.creditTransactionType === "payment"
        ? ("debt_payment" as "debt_payment" | "sale_payment")
        : "sale_payment") as "sale_payment" | "debt_payment",
      notes: paymentRow.creditTransactionNotes,
    }));
    const paidAmount = payments.reduce(
      (total, currentPayment) => total + currentPayment.amount,
      0
    );
    const effectivePaidAmount = saleRow.status === "cancelled" ? 0 : paidAmount;

    return {
      id: saleRow.id,
      status: saleRow.status,
      createdAt: normalizeTimestamp(saleRow.createdAt),
      subtotal: normalizeNumber(saleRow.subtotal),
      taxAmount: normalizeNumber(saleRow.taxAmount),
      discountAmount: normalizeNumber(saleRow.discountAmount),
      totalAmount: normalizeNumber(saleRow.totalAmount),
      paidAmount: effectivePaidAmount,
      balanceDue:
        saleRow.status === "cancelled"
          ? 0
          : Math.max(
              normalizeNumber(saleRow.totalAmount) - effectivePaidAmount,
              0
            ),
      customer: saleRow.customerId
        ? {
            id: saleRow.customerId,
            name: saleRow.customerName ?? "Cliente",
            phone: saleRow.customerPhone,
            documentType: saleRow.customerDocumentType,
            documentNumber: saleRow.customerDocumentNumber,
          }
        : null,
      cashier: saleRow.cashierId
        ? {
            id: saleRow.cashierId,
            name: saleRow.cashierName ?? "Cajero",
            email: saleRow.cashierEmail,
          }
        : null,
      shift: saleRow.shiftId
        ? {
            id: saleRow.shiftId,
            terminalName: saleRow.terminalName,
          }
        : null,
      payments,
      items: itemRows.map((itemRow) => ({
        id: itemRow.id,
        productId: itemRow.productId,
        name: itemRow.productName,
        quantity: normalizeNumber(itemRow.quantity),
        unitPrice: normalizeNumber(itemRow.unitPrice),
        subtotal: normalizeNumber(itemRow.subtotal),
        taxRate: normalizeNumber(itemRow.taxRate),
        taxAmount: normalizeNumber(itemRow.taxAmount),
        discountAmount: normalizeNumber(itemRow.discountAmount),
        totalAmount: normalizeNumber(itemRow.totalAmount),
        modifiers: modifiersBySaleItemId.get(itemRow.id) ?? [],
      })),
    };
  }
);

export const create = orgRequiredProcedure.create.handler(
  async ({ input, context }) =>
    createCoreSale(input, {
      db: context.db,
      organizationId: context.organizationId,
      userId: context.user.id,
    })
);

async function fetchAndValidateCancellationTarget(
  tx: DbTransaction,
  saleId: string,
  organizationId: string,
  userId: string
) {
  const [targetSale] = await tx
    .select({
      id: sale.id,
      shiftId: sale.shiftId,
      customerId: sale.customerId,
      status: sale.status,
    })
    .from(sale)
    .where(and(eq(sale.id, saleId), eq(sale.organizationId, organizationId)))
    .limit(1);

  if (!targetSale) {
    throw new ORPCError("NOT_FOUND", {
      message: "Venta no encontrada para la organización activa",
    });
  }
  if (targetSale.status === "cancelled") {
    throw new ORPCError("BAD_REQUEST", {
      message: "La venta ya está anulada",
    });
  }

  const [targetShift] = await tx
    .select({
      id: shift.id,
      status: shift.status,
      userId: shift.userId,
    })
    .from(shift)
    .where(
      and(
        eq(shift.id, targetSale.shiftId),
        eq(shift.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!targetShift) {
    throw new ORPCError("NOT_FOUND", {
      message: "Turno no encontrado para la venta seleccionada",
    });
  }
  if (targetShift.status !== "open") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Solo se puede anular una venta de un turno abierto",
    });
  }
  if (targetShift.userId !== userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Solo el cajero del turno puede anular la venta",
    });
  }

  return targetSale;
}

function validateCreditTransactionRules(
  chargeTransactions: Array<{
    id: string;
    creditAccountId: string;
    amount: number;
  }>,
  paymentTransactions: Array<{ id: string }>,
  targetSale: { status: string; id: string }
) {
  if (paymentTransactions.length > 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "No se puede anular una venta con abonos registrados",
    });
  }

  if (targetSale.status === "credit" && chargeTransactions.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "La venta a crédito no tiene un cargo asociado para poder anularse",
    });
  }
}

function buildStockRestorations(
  saleItemRows: Array<{
    productId: string;
    quantity: number;
    productName: string;
    trackInventory: boolean;
  }>,
  saleModifierRows: Array<{
    productId: string;
    baseQuantity: number;
    modifierQuantity: number;
    productName: string;
    trackInventory: boolean;
  }>
) {
  const stockRestorations = new Map<
    string,
    { quantity: number; productName: string; trackInventory: boolean }
  >();
  for (const itemRow of saleItemRows) {
    stockRestorations.set(itemRow.productId, {
      quantity:
        (stockRestorations.get(itemRow.productId)?.quantity ?? 0) +
        itemRow.quantity,
      productName: itemRow.productName,
      trackInventory: itemRow.trackInventory,
    });
  }
  for (const modifierRow of saleModifierRows) {
    stockRestorations.set(modifierRow.productId, {
      quantity:
        (stockRestorations.get(modifierRow.productId)?.quantity ?? 0) +
        modifierRow.baseQuantity * modifierRow.modifierQuantity,
      productName: modifierRow.productName,
      trackInventory: modifierRow.trackInventory,
    });
  }
  return stockRestorations;
}

function restoreProductStock(
  tx: DbTransaction,
  entriesToRestore: Array<{
    productId: string;
    restoration: {
      quantity: number;
      productName: string;
      trackInventory: boolean;
    };
  }>,
  organizationId: string
) {
  return Promise.all(
    entriesToRestore.map(({ productId, restoration }) =>
      tx
        .update(product)
        .set({
          stock: sql`${product.stock} + ${restoration.quantity}`,
        })
        .where(
          and(
            eq(product.id, productId),
            eq(product.organizationId, organizationId)
          )
        )
        .returning({ id: product.id })
        .then((updatedProducts) => {
          if (updatedProducts.length === 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: `No fue posible restaurar el stock de ${restoration.productName}`,
            });
          }
          return { productId, restoration };
        })
    )
  );
}

async function reverseCreditCharges(
  tx: DbTransaction,
  chargeTransactions: Array<{
    id: string;
    creditAccountId: string;
    amount: number;
  }>,
  organizationId: string,
  cancelledAt: Date
) {
  await Promise.all(
    chargeTransactions.map(async (chargeTransaction) => {
      const [creditAccountRow] = await tx
        .select({
          id: creditAccount.id,
          balance: creditAccount.balance,
        })
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.id, chargeTransaction.creditAccountId),
            eq(creditAccount.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!creditAccountRow) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cuenta de crédito no encontrada para anular la venta",
        });
      }
      if (creditAccountRow.balance < chargeTransaction.amount) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "La cuenta de crédito ya no coincide con la deuda de esta venta",
        });
      }

      await tx
        .update(creditAccount)
        .set({
          balance: creditAccountRow.balance - chargeTransaction.amount,
          updatedAt: cancelledAt,
        })
        .where(
          and(
            eq(creditAccount.id, creditAccountRow.id),
            eq(creditAccount.organizationId, organizationId)
          )
        );
    })
  );
}

export const cancel = orgRequiredProcedure.cancel.handler(
  ({ input, context }) => {
    const { db: txCtx, organizationId, user } = context;
    const userId = user.id;
    const cancelledAt = input.cancelledAt
      ? new Date(input.cancelledAt)
      : new Date();

    return txCtx.transaction(async (tx) => {
      const targetSale = await fetchAndValidateCancellationTarget(
        tx,
        input.saleId,
        organizationId,
        userId
      );

      const [chargeTransactions, paymentTransactions] = await Promise.all([
        tx
          .select({
            id: creditTransaction.id,
            creditAccountId: creditTransaction.creditAccountId,
            amount: creditTransaction.amount,
          })
          .from(creditTransaction)
          .where(
            and(
              eq(creditTransaction.organizationId, organizationId),
              eq(creditTransaction.saleId, targetSale.id),
              eq(creditTransaction.type, "charge")
            )
          ),
        tx
          .select({ id: creditTransaction.id })
          .from(creditTransaction)
          .where(
            and(
              eq(creditTransaction.organizationId, organizationId),
              eq(creditTransaction.saleId, targetSale.id),
              eq(creditTransaction.type, "payment")
            )
          )
          .limit(1),
      ]);

      validateCreditTransactionRules(
        chargeTransactions,
        paymentTransactions,
        targetSale
      );

      const [saleItemRows, saleModifierRows] = await Promise.all([
        tx
          .select({
            productId: saleItem.productId,
            quantity: saleItem.quantity,
            productName: product.name,
            trackInventory: product.trackInventory,
          })
          .from(saleItem)
          .innerJoin(
            product,
            and(
              eq(product.id, saleItem.productId),
              eq(product.organizationId, organizationId)
            )
          )
          .where(
            and(
              eq(saleItem.organizationId, organizationId),
              eq(saleItem.saleId, targetSale.id)
            )
          ),
        tx
          .select({
            productId: saleItemModifier.modifierProductId,
            baseQuantity: saleItem.quantity,
            modifierQuantity: saleItemModifier.quantity,
            productName: product.name,
            trackInventory: product.trackInventory,
          })
          .from(saleItemModifier)
          .innerJoin(
            saleItem,
            and(
              eq(saleItem.id, saleItemModifier.saleItemId),
              eq(saleItem.organizationId, organizationId)
            )
          )
          .innerJoin(
            product,
            and(
              eq(product.id, saleItemModifier.modifierProductId),
              eq(product.organizationId, organizationId)
            )
          )
          .where(
            and(
              eq(saleItemModifier.organizationId, organizationId),
              eq(saleItem.saleId, targetSale.id)
            )
          ),
      ]);

      const stockRestorations = buildStockRestorations(
        saleItemRows,
        saleModifierRows
      );

      const entriesToRestore: Array<{
        productId: string;
        restoration: {
          quantity: number;
          productName: string;
          trackInventory: boolean;
        };
      }> = [];
      for (const [productId, restoration] of stockRestorations.entries()) {
        if (!restoration.trackInventory || restoration.quantity <= 0) {
          continue;
        }
        entriesToRestore.push({ productId, restoration });
      }

      const restoreResults = await restoreProductStock(
        tx,
        entriesToRestore,
        organizationId
      );

      const inventoryRows: (typeof inventoryMovement.$inferInsert)[] =
        restoreResults.map(({ productId, restoration }) => ({
          id: crypto.randomUUID(),
          organizationId,
          productId,
          userId,
          type: "adjustment",
          quantity: restoration.quantity,
          notes: `Anulacion venta ${targetSale.id}`,
          createdAt: cancelledAt,
        }));

      if (inventoryRows.length > 0) {
        await tx.insert(inventoryMovement).values(inventoryRows);
      }

      await reverseCreditCharges(
        tx,
        chargeTransactions,
        organizationId,
        cancelledAt
      );

      await tx
        .update(sale)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(sale.id, targetSale.id),
            eq(sale.organizationId, organizationId)
          )
        );

      return {
        saleId: targetSale.id,
        status: "cancelled" as const,
        cancelledAt: cancelledAt.getTime(),
      };
    });
  }
);
