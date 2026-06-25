import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type {
  CancelSaleInputSchema,
  CreateSaleInputSchema,
} from "@/features/sales/sales.schema";
import {
  buildSaleDetail,
  buildSaleFilterOptions,
  buildSalesListPage,
  filterSalesByBalanceStatus,
  normalizeSalesListLimit,
  type SalesListParams,
  type SaleWithRelations,
} from "@/features/sales/sales.shared";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;
type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;
type CancelSaleInput = z.infer<typeof CancelSaleInputSchema>;

function buildSalesListQueryArgs(input: SalesListParams) {
  return {
    limit: normalizeSalesListLimit(input.limit),
    cursor: input.cursor ?? null,
    status: input.status ?? null,
    searchQuery: input.searchQuery ?? null,
    paymentMethod: input.paymentMethod ?? null,
    cashierId: input.cashierId ?? null,
    terminalName: input.terminalName ?? null,
    amountMin: input.amountMin ?? null,
    amountMax: input.amountMax ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
  };
}

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

  const tenderedAmount = (input.payments ?? []).reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const paidAmount = Math.min(saleRow.totalAmount, tenderedAmount);

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
  const listQueryArgs = buildSalesListQueryArgs(input);
  const [saleRows, organizationRows, memberRows, shiftRows] = await Promise.all(
    [
      zeroDb.run(queries.sales.list.fn({ args: listQueryArgs, ctx })),
      zeroDb.run(queries.organization.current.fn({ args: undefined, ctx })),
      zeroDb.run(queries.sales.filterOptions.fn({ args: undefined, ctx })),
      zeroDb.run(queries.sales.terminalOptions.fn({ args: undefined, ctx })),
    ]
  );
  const filteredRows = filterSalesByBalanceStatus(
    saleRows as SaleWithRelations[],
    input.balanceStatus
  );
  const paginated = buildSalesListPage(filteredRows, listQueryArgs.limit);
  const filterOptions = buildSaleFilterOptions({
    members: memberRows.map((memberRow) => ({
      userId: memberRow.userId,
      user: (
        memberRow as {
          user?: { name?: string | null } | null;
        }
      ).user,
    })),
    organizationMetadata:
      typeof organizationRows[0]?.metadata === "string"
        ? organizationRows[0]?.metadata
        : null,
    terminalNames: shiftRows
      .map((shiftRow) => shiftRow.terminalName)
      .filter((terminalName): terminalName is string => Boolean(terminalName)),
  });

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
