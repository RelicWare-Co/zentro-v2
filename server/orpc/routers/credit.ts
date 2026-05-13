import { implement, ORPCError } from "@orpc/server";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { organization } from "../../../database/drizzle/schema/auth.schema";
import {
  creditAccount,
  creditTransaction,
} from "../../../database/drizzle/schema/credit.schema";
import { customer } from "../../../database/drizzle/schema/customer.schema";
import { shift } from "../../../database/drizzle/schema/pos.schema";
import { payment, sale } from "../../../database/drizzle/schema/sales.schema";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import type { AppContext } from "../context";
import { creditContract } from "../contracts/credit";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const creditImplementer = implement(creditContract).$context<AppContext>();

const orgRequiredProcedure = creditImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

function normalizeLimit(limit?: number | null) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function normalizeCursor(cursor?: number | null) {
  return Math.max(cursor ?? 0, 0);
}

function normalizeSearchQuery(searchQuery?: string | null) {
  return searchQuery?.trim().toLowerCase() ?? "";
}

function normalizeCount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" es obligatorio`,
    });
  }

  return normalized;
}

function toPositiveInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor a 0`,
    });
  }

  return Math.round(value);
}

function resolveDate(input: number | undefined, fieldName: string) {
  if (input === undefined) {
    return new Date();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" no es una fecha válida`,
    });
  }

  return new Date(Math.round(input));
}

export const searchAccounts = orgRequiredProcedure.searchAccounts.handler(
  async ({ input, context }) => {
    const limit = normalizeLimit(input.limit);
    const cursor = normalizeCursor(input.cursor);
    const normalizedSearch = normalizeSearchQuery(input.searchQuery);
    const searchPattern = `%${normalizedSearch}%`;

    const clauses = [
      eq(creditAccount.organizationId, context.organizationId),
      isNull(customer.deletedAt),
    ];
    if (normalizedSearch) {
      clauses.push(
        sql`(
					lower(${customer.name}) LIKE ${searchPattern} OR
					lower(${customer.documentNumber}) LIKE ${searchPattern} OR
					lower(${customer.phone}) LIKE ${searchPattern} OR
					lower(${customer.email}) LIKE ${searchPattern}
				)`
      );
    }

    const [rows, totalRows] = await Promise.all([
      context.db
        .select({
          id: creditAccount.id,
          customerId: creditAccount.customerId,
          balance: creditAccount.balance,
          interestRate: creditAccount.interestRate,
          createdAt: creditAccount.createdAt,
          updatedAt: creditAccount.updatedAt,
          customerName: customer.name,
          customerDocument: customer.documentNumber,
          customerPhone: customer.phone,
        })
        .from(creditAccount)
        .innerJoin(
          customer,
          and(
            eq(customer.id, creditAccount.customerId),
            eq(customer.organizationId, context.organizationId)
          )
        )
        .where(and(...clauses))
        .orderBy(asc(customer.name), asc(creditAccount.id))
        .limit(limit + 1)
        .offset(cursor),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(creditAccount)
        .innerJoin(
          customer,
          and(
            eq(customer.id, creditAccount.customerId),
            eq(customer.organizationId, context.organizationId)
          )
        )
        .where(and(...clauses)),
    ]);

    return {
      data: rows.slice(0, limit).map((row) => ({
        ...row,
        createdAt: toTimestamp(row.createdAt),
        updatedAt: toTimestamp(row.updatedAt),
      })),
      hasMore: rows.length > limit,
      total: normalizeCount(totalRows[0]?.total),
      nextCursor: rows.length > limit ? cursor + limit : null,
    };
  }
);

export const transactions = orgRequiredProcedure.transactions.handler(
  async ({ input, context }) => {
    const limit = normalizeLimit(input.limit);
    const cursor = normalizeCursor(input.cursor);

    const [accountRow] = await context.db
      .select({ id: creditAccount.id })
      .from(creditAccount)
      .where(
        and(
          eq(creditAccount.id, input.creditAccountId),
          eq(creditAccount.organizationId, context.organizationId)
        )
      )
      .limit(1);

    if (!accountRow) {
      throw new ORPCError("NOT_FOUND", {
        message: "Cuenta de crédito no encontrada para la organización activa",
      });
    }

    const transactionClauses = [
      eq(creditTransaction.organizationId, context.organizationId),
      eq(creditTransaction.creditAccountId, input.creditAccountId),
    ];

    const [rows, totalRows] = await Promise.all([
      context.db
        .select({
          id: creditTransaction.id,
          type: creditTransaction.type,
          amount: creditTransaction.amount,
          notes: creditTransaction.notes,
          saleId: creditTransaction.saleId,
          paymentId: creditTransaction.paymentId,
          createdAt: creditTransaction.createdAt,
        })
        .from(creditTransaction)
        .where(and(...transactionClauses))
        .orderBy(desc(creditTransaction.createdAt), desc(creditTransaction.id))
        .limit(limit + 1)
        .offset(cursor),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(creditTransaction)
        .where(and(...transactionClauses)),
    ]);

    return {
      data: rows.slice(0, limit).map((row) => ({
        ...row,
        createdAt: toTimestamp(row.createdAt),
      })),
      hasMore: rows.length > limit,
      total: normalizeCount(totalRows[0]?.total),
      nextCursor: rows.length > limit ? cursor + limit : null,
    };
  }
);

export const registerPayment = orgRequiredProcedure.registerPayment.handler(
  ({ input, context }) => {
    const amount = toPositiveInteger(input.amount, "amount");
    const saleId = normalizeOptionalString(input.saleId);
    const method = normalizeRequiredString(
      input.method,
      "method"
    ).toLowerCase();
    const reference = normalizeOptionalString(input.reference);
    const notes = normalizeOptionalString(input.notes);
    const createdAt = resolveDate(input.createdAt, "createdAt");

    return context.db.transaction(async (tx) => {
      const [targetShift] = await tx
        .select({ id: shift.id, userId: shift.userId, status: shift.status })
        .from(shift)
        .where(
          and(
            eq(shift.id, input.shiftId),
            eq(shift.organizationId, context.organizationId)
          )
        )
        .limit(1);

      if (!targetShift) {
        throw new ORPCError("NOT_FOUND", {
          message: "Turno no encontrado para la organización activa",
        });
      }
      if (targetShift.status !== "open") {
        throw new ORPCError("BAD_REQUEST", {
          message: "No se puede registrar pago en un turno cerrado",
        });
      }
      if (targetShift.userId !== context.user.id) {
        throw new ORPCError("FORBIDDEN", {
          message: "Solo el cajero del turno puede registrar pagos",
        });
      }

      const [organizationRow] = await tx
        .select({
          metadata: organization.metadata,
        })
        .from(organization)
        .where(eq(organization.id, context.organizationId))
        .limit(1);
      const enabledPaymentMethodIds = new Set(
        getEnabledPaymentMethods(
          parseOrganizationSettingsMetadata(organizationRow?.metadata)
        ).map((paymentMethod) => paymentMethod.id)
      );
      if (!enabledPaymentMethodIds.has(method)) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Método de pago no habilitado: ${method}`,
        });
      }

      const [accountRow] = await tx
        .select({
          id: creditAccount.id,
          customerId: creditAccount.customerId,
          balance: creditAccount.balance,
          customerDeletedAt: customer.deletedAt,
        })
        .from(creditAccount)
        .innerJoin(
          customer,
          and(
            eq(customer.id, creditAccount.customerId),
            eq(customer.organizationId, context.organizationId)
          )
        )
        .where(
          and(
            eq(creditAccount.id, input.creditAccountId),
            eq(creditAccount.organizationId, context.organizationId)
          )
        )
        .limit(1);

      if (!accountRow || accountRow.customerDeletedAt) {
        throw new ORPCError("NOT_FOUND", {
          message: "Cuenta de crédito no encontrada o cliente inactivo",
        });
      }
      if (accountRow.balance <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "La cuenta no tiene saldo pendiente por cobrar",
        });
      }
      if (amount > accountRow.balance) {
        throw new ORPCError("BAD_REQUEST", {
          message: "El abono no puede superar el saldo pendiente",
        });
      }

      let targetSale: {
        id: string;
        customerId: string | null;
        status: string;
        totalAmount: number;
      } | null = null;
      let saleBalanceDue: number | null = null;
      if (saleId) {
        const [saleRow] = await tx
          .select({
            id: sale.id,
            customerId: sale.customerId,
            status: sale.status,
            totalAmount: sale.totalAmount,
          })
          .from(sale)
          .where(
            and(
              eq(sale.id, saleId),
              eq(sale.organizationId, context.organizationId)
            )
          )
          .limit(1);

        if (!saleRow) {
          throw new ORPCError("NOT_FOUND", {
            message: "Venta no encontrada para la organización activa",
          });
        }
        if (
          !saleRow.customerId ||
          saleRow.customerId !== accountRow.customerId
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "La venta seleccionada no pertenece a la cuenta de crédito indicada",
          });
        }
        if (saleRow.status === "cancelled") {
          throw new ORPCError("BAD_REQUEST", {
            message: "No se puede registrar un abono sobre una venta cancelada",
          });
        }

        const salePaymentRows = await tx
          .select({ amount: payment.amount })
          .from(payment)
          .where(
            and(
              eq(payment.organizationId, context.organizationId),
              eq(payment.saleId, saleRow.id)
            )
          );

        saleBalanceDue =
          saleRow.totalAmount -
          salePaymentRows.reduce(
            (total, currentPayment) => total + currentPayment.amount,
            0
          );
        if (saleBalanceDue <= 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "La venta seleccionada ya no tiene saldo pendiente",
          });
        }
        if (amount > saleBalanceDue) {
          throw new ORPCError("BAD_REQUEST", {
            message: "El abono no puede superar el saldo pendiente de la venta",
          });
        }

        targetSale = saleRow;
      }

      const paymentId = crypto.randomUUID();
      await tx.insert(payment).values({
        id: paymentId,
        organizationId: context.organizationId,
        saleId,
        shiftId: input.shiftId,
        method,
        reference,
        amount,
        createdAt,
      });

      const newBalance = accountRow.balance - amount;
      await tx
        .update(creditAccount)
        .set({ balance: newBalance, updatedAt: createdAt })
        .where(
          and(
            eq(creditAccount.id, input.creditAccountId),
            eq(creditAccount.organizationId, context.organizationId)
          )
        );

      const transactionId = crypto.randomUUID();
      await tx.insert(creditTransaction).values({
        id: transactionId,
        organizationId: context.organizationId,
        creditAccountId: input.creditAccountId,
        saleId,
        paymentId,
        type: "payment",
        amount,
        notes,
        createdAt,
      });

      if (targetSale && saleBalanceDue !== null) {
        const remainingSaleBalance = saleBalanceDue - amount;
        await tx
          .update(sale)
          .set({
            status: remainingSaleBalance > 0 ? "credit" : "completed",
          })
          .where(
            and(
              eq(sale.id, targetSale.id),
              eq(sale.organizationId, context.organizationId)
            )
          );
      }

      return {
        creditAccountId: input.creditAccountId,
        saleId,
        paymentId,
        transactionId,
        amount,
        newBalance,
      };
    });
  }
);
