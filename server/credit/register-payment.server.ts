import { and, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type { RegisterCreditPaymentSchema } from "@/schemas/credit";

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
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }

  return normalized;
}

function toPositiveInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
  }

  return Math.round(value);
}

function resolveDate(input: number | undefined, fieldName: string) {
  if (input === undefined) {
    return new Date();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new Error(`El campo "${fieldName}" no es una fecha válida`);
  }

  return new Date(Math.round(input));
}

async function validateShiftForPayment(
  tx: CreditPaymentDbExecutor,
  shiftId: string,
  organizationId: string,
  userId: string
) {
  const [targetShift] = await tx
    .select({ id: shift.id, userId: shift.userId, status: shift.status })
    .from(shift)
    .where(and(eq(shift.id, shiftId), eq(shift.organizationId, organizationId)))
    .limit(1);

  if (!targetShift) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  if (targetShift.status !== "open") {
    throw new Error("No se puede registrar pago en un turno cerrado");
  }
  if (targetShift.userId !== userId) {
    throw new Error("Solo el cajero del turno puede registrar pagos");
  }
}

async function validateEnabledPaymentMethod(
  tx: CreditPaymentDbExecutor,
  organizationId: string,
  method: string
) {
  const [organizationRow] = await tx
    .select({
      metadata: organization.metadata,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const enabledPaymentMethodIds = new Set(
    getEnabledPaymentMethods(
      parseOrganizationSettingsMetadata(organizationRow?.metadata)
    ).map((paymentMethod) => paymentMethod.id)
  );
  if (!enabledPaymentMethodIds.has(method)) {
    throw new Error(`Método de pago no habilitado: ${method}`);
  }
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
    .select({
      id: sale.id,
      customerId: sale.customerId,
      status: sale.status,
      totalAmount: sale.totalAmount,
    })
    .from(sale)
    .where(and(eq(sale.id, saleId), eq(sale.organizationId, organizationId)))
    .limit(1);

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
    validateShiftForPayment(
      tx,
      input.shiftId,
      context.organizationId,
      context.userId
    ),
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

  await tx.insert(payment).values({
    id: input.paymentId,
    organizationId: context.organizationId,
    saleId,
    shiftId: input.shiftId,
    method,
    reference,
    amount,
    createdAt,
  });

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

  await tx.insert(creditTransaction).values({
    id: input.transactionId,
    organizationId: context.organizationId,
    creditAccountId: input.creditAccountId,
    saleId,
    paymentId: input.paymentId,
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
    paymentId: input.paymentId,
    transactionId: input.transactionId,
    amount,
    newBalance,
  };
}
