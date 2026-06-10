import { and, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import {
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import {
  sale,
  saleItem,
  saleItemModifier,
} from "@/database/drizzle/schema/sales.schema";
import type {
  CancelSaleInputSchema,
  CancelSaleResultSchema,
} from "@/schemas/sales";

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
    throw new Error("Turno no encontrado para la venta seleccionada");
  }
  if (targetShift.status !== "open") {
    throw new Error("Solo se puede anular una venta de un turno abierto");
  }
  if (targetShift.userId !== userId) {
    throw new Error("Solo el cajero del turno puede anular la venta");
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
    throw new Error("No se puede anular una venta con abonos registrados");
  }

  if (targetSale.status === "credit" && chargeTransactions.length === 0) {
    throw new Error(
      "La venta a crédito no tiene un cargo asociado para poder anularse"
    );
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
  tx: CancelSaleDbExecutor,
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
            throw new Error(
              `No fue posible restaurar el stock de ${restoration.productName}`
            );
          }
          return { productId, restoration };
        })
    )
  );
}

async function reverseCreditCharges(
  tx: CancelSaleDbExecutor,
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
        .select({ id: creditAccount.id })
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.id, chargeTransaction.creditAccountId),
            eq(creditAccount.organizationId, organizationId)
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
          updatedAt: cancelledAt,
        })
        .where(
          and(
            eq(creditAccount.id, creditAccountRow.id),
            eq(creditAccount.organizationId, organizationId),
            gte(creditAccount.balance, chargeTransaction.amount)
          )
        )
        .returning({ id: creditAccount.id });

      if (updatedAccounts.length === 0) {
        throw new Error(
          "La cuenta de crédito ya no coincide con la deuda de esta venta"
        );
      }
    })
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
      and(eq(sale.id, targetSale.id), eq(sale.organizationId, organizationId))
    );

  return {
    saleId: targetSale.id,
    status: "cancelled",
    cancelledAt: cancelledAt.getTime(),
  };
}
