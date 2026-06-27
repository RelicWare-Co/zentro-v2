// Credit operations — server-only, reusable across domains.
//
// Sales (create) and cancellations import from here instead of redefining
// credit account + transaction logic.

import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import type { OrganizationSettings } from "@/features/settings/settings.shared";

type DrizzleTx = Pick<Database, "select" | "insert" | "update">;

export async function recordCreditSaleCharge(
  tx: DrizzleTx,
  input: {
    organizationId: string;
    customerId: string;
    balanceDue: number;
    saleId: string;
    createdAt: Date;
    creditSettings: OrganizationSettings["credit"];
  }
): Promise<void> {
  if (!(input.balanceDue > 0)) {
    return;
  }

  const [existingCreditAccount] = await tx
    .select({ id: creditAccount.id, balance: creditAccount.balance })
    .from(creditAccount)
    .where(
      and(
        eq(creditAccount.organizationId, input.organizationId),
        eq(creditAccount.customerId, input.customerId)
      )
    )
    .limit(1);

  let creditAccountId: string;
  if (existingCreditAccount) {
    creditAccountId = existingCreditAccount.id;
    await tx
      .update(creditAccount)
      .set({
        balance: sql`${creditAccount.balance} + ${input.balanceDue}`,
        updatedAt: input.createdAt,
      })
      .where(
        and(
          eq(creditAccount.id, existingCreditAccount.id),
          eq(creditAccount.organizationId, input.organizationId)
        )
      );
  } else {
    creditAccountId = crypto.randomUUID();
    await tx.insert(creditAccount).values({
      id: creditAccountId,
      organizationId: input.organizationId,
      customerId: input.customerId,
      balance: input.balanceDue,
      interestRate: input.creditSettings.defaultInterestRate,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });
  }

  await tx.insert(creditTransaction).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    creditAccountId,
    saleId: input.saleId,
    type: "charge",
    amount: input.balanceDue,
    notes: `Cargo por venta ${input.saleId}`,
    createdAt: input.createdAt,
  });
}

export async function reverseCreditSaleCharges(
  tx: DrizzleTx,
  input: {
    organizationId: string;
    saleId: string;
    cancelledAt: Date;
  }
): Promise<void> {
  const chargeTransactions = await tx
    .select({
      id: creditTransaction.id,
      creditAccountId: creditTransaction.creditAccountId,
      amount: creditTransaction.amount,
    })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.organizationId, input.organizationId),
        eq(creditTransaction.saleId, input.saleId),
        eq(creditTransaction.type, "charge")
      )
    );

  await Promise.all(
    chargeTransactions.map(async (chargeTransaction) => {
      const [creditAccountRow] = await tx
        .select({ id: creditAccount.id })
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.id, chargeTransaction.creditAccountId),
            eq(creditAccount.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!creditAccountRow) {
        throw new Error("Cuenta de crédito no encontrada para anular la venta");
      }

      const updatedAccounts = await tx
        .update(creditAccount)
        .set({
          balance: sql`${creditAccount.balance} - ${chargeTransaction.amount}`,
          updatedAt: input.cancelledAt,
        })
        .where(
          and(
            eq(creditAccount.id, creditAccountRow.id),
            eq(creditAccount.organizationId, input.organizationId),
            gte(creditAccount.balance, chargeTransaction.amount)
          )
        )
        .returning({ id: creditAccount.id });

      if (updatedAccounts.length === 0) {
        throw new Error(
          "La cuenta de crédito ya no coincide con la deuda de esta venta"
        );
      }

      await tx.insert(creditTransaction).values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        creditAccountId: chargeTransaction.creditAccountId,
        saleId: input.saleId,
        type: "reversal",
        amount: chargeTransaction.amount,
        notes: `Anulacion venta ${input.saleId}`,
        createdAt: input.cancelledAt,
      });
    })
  );
}
