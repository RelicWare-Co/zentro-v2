import { and, eq, ne } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { creditTransaction } from "@/database/drizzle/schema/credit.schema";
import { cashMovement } from "@/database/drizzle/schema/pos.schema";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import { reverseCreditSaleCharges } from "@/features/credit/credit-operations.server";
import { restoreSaleInventory } from "@/features/inventory/inventory-operations.server";
import type {
  CancelSaleInputSchema,
  CancelSaleResultSchema,
} from "@/features/sales/sales.schema";
import { assertOpenShiftForCancellation } from "@/features/shifts/shift-operations.server";

export type CancelSaleDbExecutor = Pick<
  Database,
  "select" | "insert" | "update"
>;

type CancelSaleInput = z.infer<typeof CancelSaleInputSchema>;
type CancelSaleResult = z.infer<typeof CancelSaleResultSchema>;

async function fetchAndValidateCancellationTarget(
  tx: CancelSaleDbExecutor,
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
    throw new Error("Venta no encontrada para la organización activa");
  }
  if (targetSale.status === "cancelled") {
    throw new Error("La venta ya está anulada");
  }

  await assertOpenShiftForCancellation(tx, {
    shiftId: targetSale.shiftId,
    organizationId,
    userId,
  });

  return targetSale;
}

function validateCreditTransactionRules(
  chargeTransactions: Array<{
    id: string;
    creditAccountId: string;
    amount: number;
  }>,
  paymentRows: Array<{ id: string }>,
  paymentTransactions: Array<{ id: string }>,
  targetSale: { status: string; id: string }
) {
  if (targetSale.status !== "completed" && paymentRows.length > 0) {
    throw new Error("No se puede anular una venta con cobros registrados");
  }

  if (paymentTransactions.length > 0) {
    throw new Error("No se puede anular una venta con abonos registrados");
  }

  if (targetSale.status === "credit" && chargeTransactions.length === 0) {
    throw new Error(
      "La venta a crédito no tiene un cargo asociado para poder anularse"
    );
  }
}

async function insertPaymentReversals(
  tx: CancelSaleDbExecutor,
  paymentRows: Array<{
    amount: number;
    appliedAmount: number;
    changeAmount: number;
    id: string;
    method: string;
    reference: string | null;
    saleId: string | null;
    shiftId: string;
  }>,
  organizationId: string,
  cancelledAt: Date
) {
  const reversiblePayments = paymentRows.filter(
    (paymentRow) =>
      paymentRow.amount !== 0 ||
      paymentRow.appliedAmount !== 0 ||
      paymentRow.changeAmount !== 0
  );

  if (reversiblePayments.length === 0) {
    return;
  }

  await tx.insert(payment).values(
    reversiblePayments.map((paymentRow) => ({
      id: crypto.randomUUID(),
      organizationId,
      saleId: paymentRow.saleId,
      shiftId: paymentRow.shiftId,
      method: paymentRow.method,
      reference: `reversal:${paymentRow.id}`,
      amount: -paymentRow.amount,
      appliedAmount: -paymentRow.appliedAmount,
      changeAmount: -paymentRow.changeAmount,
      createdAt: cancelledAt,
    }))
  );
}

async function insertAutoPayoutReversals(
  tx: CancelSaleDbExecutor,
  saleId: string,
  organizationId: string,
  cancelledAt: Date
) {
  const autoPayouts = await tx
    .select({
      id: cashMovement.id,
      shiftId: cashMovement.shiftId,
      type: cashMovement.type,
      paymentMethod: cashMovement.paymentMethod,
      amount: cashMovement.amount,
      description: cashMovement.description,
    })
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.organizationId, organizationId),
        eq(cashMovement.sourceSaleId, saleId),
        eq(cashMovement.sourceType, "sale_auto_payout")
      )
    );

  if (autoPayouts.length === 0) {
    return;
  }

  await tx.insert(cashMovement).values(
    autoPayouts.map((payout) => ({
      id: crypto.randomUUID(),
      organizationId,
      shiftId: payout.shiftId,
      type: payout.type,
      paymentMethod: payout.paymentMethod,
      amount: -payout.amount,
      description: `Reversa - ${payout.description}`,
      sourceType: "sale_auto_payout_reversal",
      sourceSaleId: saleId,
      createdAt: cancelledAt,
    }))
  );
}

export async function runCancelSale(
  tx: CancelSaleDbExecutor,
  input: CancelSaleInput,
  ctx: { organizationId: string; userId: string }
): Promise<CancelSaleResult> {
  const { organizationId, userId } = ctx;
  const cancelledAt = input.cancelledAt
    ? new Date(input.cancelledAt)
    : new Date();

  const targetSale = await fetchAndValidateCancellationTarget(
    tx,
    input.saleId,
    organizationId,
    userId
  );

  const [chargeTransactions, salePaymentRows, paymentTransactions] =
    await Promise.all([
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
        .select({
          id: payment.id,
          saleId: payment.saleId,
          shiftId: payment.shiftId,
          method: payment.method,
          reference: payment.reference,
          amount: payment.amount,
          appliedAmount: payment.appliedAmount,
          changeAmount: payment.changeAmount,
        })
        .from(payment)
        .where(
          and(
            eq(payment.organizationId, organizationId),
            eq(payment.saleId, targetSale.id)
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
    salePaymentRows,
    paymentTransactions,
    targetSale
  );

  const cancelledRows = await tx
    .update(sale)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(sale.id, targetSale.id),
        eq(sale.organizationId, organizationId),
        ne(sale.status, "cancelled")
      )
    )
    .returning({ id: sale.id });

  if (cancelledRows.length === 0) {
    throw new Error("La venta ya está anulada");
  }

  if (targetSale.status === "completed") {
    await insertPaymentReversals(
      tx,
      salePaymentRows,
      organizationId,
      cancelledAt
    );
  }

  await insertAutoPayoutReversals(
    tx,
    targetSale.id,
    organizationId,
    cancelledAt
  );

  await restoreSaleInventory(tx, {
    organizationId,
    userId,
    saleId: targetSale.id,
    cancelledAt,
  });

  await reverseCreditSaleCharges(tx, {
    organizationId,
    saleId: targetSale.id,
    cancelledAt,
  });

  return {
    saleId: targetSale.id,
    status: "cancelled",
    cancelledAt: cancelledAt.getTime(),
  };
}
