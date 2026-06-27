import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import type { RegisterCreditPaymentSchema } from "@/features/credit/credit.schema";
import { validateEnabledPaymentMethod } from "@/features/settings/payment-methods.server";
import { assertOpenShiftForPayment } from "@/features/shifts/shift-operations.server";
import {
  normalizeNumber,
  normalizeOptionalString,
  normalizeRequiredString,
  resolveDate,
  toPositiveInteger,
} from "@/lib/domain-values.shared";

type CreditPaymentDbExecutor = Pick<Database, "select" | "insert" | "update">;

export type { CreditPaymentDbExecutor };

type RegisterCreditPaymentInput = z.infer<
  typeof RegisterCreditPaymentSchema
> & {
  paymentId: string;
  transactionId: string;
};

export interface RegisterCreditPaymentContext {
  organizationId: string;
  userId: string;
}

async function fetchAndValidateCreditAccount(
  tx: CreditPaymentDbExecutor,
  creditAccountId: string,
  organizationId: string,
  amount: number
) {
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
        eq(customer.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(creditAccount.id, creditAccountId),
        eq(creditAccount.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!accountRow || accountRow.customerDeletedAt) {
    throw new Error("Cuenta de crédito no encontrada o cliente inactivo");
  }
  if (accountRow.balance <= 0) {
    throw new Error("La cuenta no tiene saldo pendiente por cobrar");
  }
  if (amount > accountRow.balance) {
    throw new Error("El abono no puede superar el saldo pendiente");
  }

  return accountRow;
}

async function fetchAndValidateSaleForPayment(
  tx: CreditPaymentDbExecutor,
  saleId: string,
  organizationId: string,
  customerId: string,
  amount: number
) {
  const [saleRow] = await tx
    .update(sale)
    .set({ status: sql`${sale.status}` })
    .where(and(eq(sale.id, saleId), eq(sale.organizationId, organizationId)))
    .returning({
      id: sale.id,
      customerId: sale.customerId,
      status: sale.status,
      totalAmount: sale.totalAmount,
    });

  if (!saleRow) {
    throw new Error("Venta no encontrada para la organización activa");
  }
  if (!saleRow.customerId || saleRow.customerId !== customerId) {
    throw new Error(
      "La venta seleccionada no pertenece a la cuenta de crédito indicada"
    );
  }
  if (saleRow.status === "cancelled") {
    throw new Error("No se puede registrar un abono sobre una venta cancelada");
  }

  const salePaymentRows = await tx
    .select({ amount: payment.amount })
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, organizationId),
        eq(payment.saleId, saleRow.id)
      )
    );

  const saleBalanceDue =
    saleRow.totalAmount -
    salePaymentRows.reduce(
      (total, currentPayment) => total + currentPayment.amount,
      0
    );
  if (saleBalanceDue <= 0) {
    throw new Error("La venta seleccionada ya no tiene saldo pendiente");
  }
  if (amount > saleBalanceDue) {
    throw new Error("El abono no puede superar el saldo pendiente de la venta");
  }

  return { saleRow, saleBalanceDue };
}

async function buildAccountPaymentAllocations(
  tx: CreditPaymentDbExecutor,
  organizationId: string,
  customerId: string,
  amount: number
) {
  let remainingAmount = amount;
  const allocations: Array<{
    amount: number;
    remainingSaleBalance: number | null;
    saleId: string | null;
  }> = [];

  const outstandingSaleRows = await tx
    .select({
      id: sale.id,
      totalAmount: sale.totalAmount,
      paidAmount: sql<number>`coalesce(sum(${payment.amount}), 0)`,
    })
    .from(sale)
    .leftJoin(
      payment,
      and(
        eq(payment.saleId, sale.id),
        eq(payment.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(sale.organizationId, organizationId),
        eq(sale.customerId, customerId),
        eq(sale.status, "credit")
      )
    )
    .groupBy(sale.id, sale.totalAmount, sale.createdAt)
    .orderBy(asc(sale.createdAt), asc(sale.id));

  for (const saleRow of outstandingSaleRows) {
    if (remainingAmount <= 0) {
      break;
    }

    const saleBalanceDue = Math.max(
      normalizeNumber(saleRow.totalAmount) -
        normalizeNumber(saleRow.paidAmount),
      0
    );
    if (saleBalanceDue <= 0) {
      continue;
    }

    const allocatedAmount = Math.min(remainingAmount, saleBalanceDue);
    allocations.push({
      saleId: saleRow.id,
      amount: allocatedAmount,
      remainingSaleBalance: saleBalanceDue - allocatedAmount,
    });
    remainingAmount -= allocatedAmount;
  }

  if (remainingAmount > 0) {
    allocations.push({
      saleId: null,
      amount: remainingAmount,
      remainingSaleBalance: null,
    });
  }

  return allocations;
}

export async function runRegisterCreditPayment(
  tx: CreditPaymentDbExecutor,
  input: RegisterCreditPaymentInput,
  context: RegisterCreditPaymentContext
) {
  const amount = toPositiveInteger(input.amount, "amount");
  const saleId = normalizeOptionalString(input.saleId);
  const method = normalizeRequiredString(input.method, "method").toLowerCase();
  const reference = normalizeOptionalString(input.reference);
  const notes = normalizeOptionalString(input.notes);
  const createdAt = resolveDate(input.createdAt, "createdAt");

  const [, , accountRow] = await Promise.all([
    assertOpenShiftForPayment(tx, {
      shiftId: input.shiftId,
      organizationId: context.organizationId,
      userId: context.userId,
    }),
    validateEnabledPaymentMethod(tx, context.organizationId, method),
    fetchAndValidateCreditAccount(
      tx,
      input.creditAccountId,
      context.organizationId,
      amount
    ),
  ]);

  let targetSale: {
    id: string;
    customerId: string | null;
    status: string;
    totalAmount: number;
  } | null = null;
  let saleBalanceDue: number | null = null;
  if (saleId) {
    const result = await fetchAndValidateSaleForPayment(
      tx,
      saleId,
      context.organizationId,
      accountRow.customerId,
      amount
    );
    targetSale = result.saleRow;
    saleBalanceDue = result.saleBalanceDue;
  }

  const updatedAccounts = await tx
    .update(creditAccount)
    .set({
      balance: sql`${creditAccount.balance} - ${amount}`,
      updatedAt: createdAt,
    })
    .where(
      and(
        eq(creditAccount.id, input.creditAccountId),
        eq(creditAccount.organizationId, context.organizationId),
        gte(creditAccount.balance, amount)
      )
    )
    .returning({ balance: creditAccount.balance });

  const updatedAccount = updatedAccounts[0];
  if (!updatedAccount) {
    throw new Error("El abono no puede superar el saldo pendiente");
  }
  const newBalance = updatedAccount.balance;

  const paymentAllocations =
    targetSale && saleBalanceDue !== null
      ? [
          {
            saleId: targetSale.id,
            amount,
            remainingSaleBalance: saleBalanceDue - amount,
          },
        ]
      : await buildAccountPaymentAllocations(
          tx,
          context.organizationId,
          accountRow.customerId,
          amount
        );

  const paymentRows = paymentAllocations.map((allocation, index) => ({
    id: index === 0 ? input.paymentId : crypto.randomUUID(),
    organizationId: context.organizationId,
    saleId: allocation.saleId,
    shiftId: input.shiftId,
    method,
    reference,
    amount: allocation.amount,
    createdAt,
  }));

  await tx.insert(payment).values(paymentRows);

  await tx.insert(creditTransaction).values(
    paymentRows.map((paymentRow, index) => ({
      id: index === 0 ? input.transactionId : crypto.randomUUID(),
      organizationId: context.organizationId,
      creditAccountId: input.creditAccountId,
      saleId: paymentRow.saleId,
      paymentId: paymentRow.id,
      type: "payment",
      amount: paymentRow.amount,
      notes,
      createdAt,
    }))
  );

  for (const allocation of paymentAllocations) {
    if (!allocation.saleId || allocation.remainingSaleBalance === null) {
      continue;
    }

    await tx
      .update(sale)
      .set({
        status: allocation.remainingSaleBalance > 0 ? "credit" : "completed",
      })
      .where(
        and(
          eq(sale.id, allocation.saleId),
          eq(sale.organizationId, context.organizationId)
        )
      );
  }

  return {
    creditAccountId: input.creditAccountId,
    saleId: paymentAllocations[0]?.saleId ?? null,
    paymentId: input.paymentId,
    transactionId: input.transactionId,
    amount,
    newBalance,
  };
}
