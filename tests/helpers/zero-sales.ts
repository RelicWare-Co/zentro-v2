import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type { CreateSaleInputSchema } from "@/schemas/sales";
import { serverMutators } from "@/src/zero/mutators.server";
import type { ZeroContext } from "@/src/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;
type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;

export async function createSaleViaZero({
  db,
  zeroDb,
  ctx,
  input,
}: {
  db: Database;
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CreateSaleInput;
}) {
  const saleId = crypto.randomUUID();

  await zeroDb.transaction((tx) =>
    serverMutators.sales.create.fn({
      args: { ...input, saleId },
      ctx,
      tx,
    })
  );

  const [saleRow] = await db
    .select({
      id: sale.id,
      status: sale.status,
      subtotal: sale.subtotal,
      taxAmount: sale.taxAmount,
      discountAmount: sale.discountAmount,
      totalAmount: sale.totalAmount,
    })
    .from(sale)
    .where(eq(sale.id, saleId))
    .limit(1);

  if (!saleRow) {
    throw new Error(`Venta no encontrada después de create: ${saleId}`);
  }

  const paidAmount = (input.payments ?? []).reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  return {
    saleId: saleRow.id,
    status: saleRow.status,
    subtotal: saleRow.subtotal,
    taxAmount: saleRow.taxAmount,
    discountAmount: saleRow.discountAmount,
    totalAmount: saleRow.totalAmount,
    paidAmount,
    balanceDue: Math.max(saleRow.totalAmount - paidAmount, 0),
  };
}
