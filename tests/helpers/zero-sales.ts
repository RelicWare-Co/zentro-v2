import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { sale } from "@/database/drizzle/schema/sales.schema";
import {
  buildSaleDetail,
  buildSaleFilterOptions,
  buildSaleListItem,
  filterSales,
  paginateSales,
  type SalesListParams,
  type SaleWithRelations,
} from "@/features/sales/sales.shared";
import type {
  CancelSaleInputSchema,
  CreateSaleInputSchema,
} from "@/schemas/sales";
import { serverMutators } from "@/src/zero/mutators.server";
import { queries } from "@/src/zero/queries";
import type { ZeroContext } from "@/src/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;
type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;
type CancelSaleInput = z.infer<typeof CancelSaleInputSchema>;

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

export async function listSalesViaZero({
  zeroDb,
  ctx,
  input = {},
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input?: SalesListParams;
}) {
  const [saleRows, organizationRows] = await Promise.all([
    zeroDb.run(queries.sales.byOrg.fn({ args: undefined, ctx })),
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
  ]);
  const normalizedRows = saleRows as SaleWithRelations[];
  const filteredRows = filterSales(normalizedRows, input);
  const filteredSales = filteredRows.map((row) => buildSaleListItem(row));
  const paginated = paginateSales(filteredSales, input);
  const filterOptions = buildSaleFilterOptions(
    normalizedRows,
    typeof organizationRows[0]?.metadata === "string"
      ? organizationRows[0]?.metadata
      : null
  );

  return {
    ...paginated,
    filterOptions,
  };
}

export async function getSaleDetailViaZero({
  zeroDb,
  ctx,
  saleId,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  saleId: string;
}) {
  const saleRows = await zeroDb.run(
    queries.sales.byId.fn({
      args: { saleId },
      ctx,
    })
  );
  const saleRow = saleRows[0] as SaleWithRelations | undefined;
  if (!saleRow) {
    return null;
  }
  return buildSaleDetail(saleRow);
}

export async function cancelSaleViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CancelSaleInput;
}) {
  return await zeroDb.transaction((tx) =>
    serverMutators.sales.cancel.fn({
      args: input,
      ctx,
      tx,
    })
  );
}
