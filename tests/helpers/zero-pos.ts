import {
  buildPosProduct,
  type PaginatePosProductsInput,
  type PosProductWithCategory,
  paginatePosProducts,
  sortPosProducts,
} from "@/features/pos/pos.shared";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";
import type { ZeroContext } from "@/src/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;

export async function listPosCategoriesViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const rows = await zeroDb.run(
    queries.products.categories.fn({ args: undefined, ctx })
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
  }));
}

export async function listPosModifiersViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const rows = await zeroDb.run(
    queries.products.modifiers.fn({ args: undefined, ctx })
  );

  return rows.map((row) => buildPosProduct(row as PosProductWithCategory));
}

export async function getPosSettingsViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const organizationRows = await zeroDb.run(
    queries.organization.current.fn({ args: undefined, ctx })
  );
  const organizationSettings = parseOrganizationSettingsMetadata(
    typeof organizationRows[0]?.metadata === "string"
      ? organizationRows[0]?.metadata
      : null
  );

  return {
    defaultTerminalName: organizationSettings.pos.defaultTerminalName,
    defaultStartingCash: organizationSettings.pos.defaultStartingCash,
    paymentMethods: getEnabledPaymentMethods(organizationSettings).map(
      (paymentMethod) => ({
        id: paymentMethod.id,
        label: paymentMethod.label,
        requiresReference: paymentMethod.requiresReference,
      })
    ),
    allowCreditSales: organizationSettings.credit.allowCreditSales,
  };
}

export async function getActiveShiftViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const rows = await zeroDb.run(
    queries.shifts.active.fn({ args: undefined, ctx })
  );
  const activeShift = rows[0];

  if (!activeShift) {
    return null;
  }

  return {
    id: activeShift.id,
    terminalId: activeShift.terminalId ?? null,
    terminalName: activeShift.terminalName ?? null,
    status: activeShift.status ?? "open",
    startingCash: activeShift.startingCash ?? 0,
    openedAt: activeShift.openedAt,
    closedAt: activeShift.closedAt ?? null,
    notes: activeShift.notes ?? null,
  };
}

export async function searchPosProductsViaZero({
  zeroDb,
  ctx,
  input = {},
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input?: {
    categoryId?: string | null;
    searchQuery?: string | null;
    limit?: number;
    cursor?: number;
  };
}) {
  const rows = await zeroDb.run(
    queries.products.posCatalog.fn({
      args: {
        categoryId: input.categoryId ?? null,
        searchQuery: input.searchQuery ?? null,
        limit: 1000,
      },
      ctx,
    })
  );
  const products = sortPosProducts(
    rows.map((row) => buildPosProduct(row as PosProductWithCategory)),
    input.searchQuery ?? null
  );
  const paginationInput: PaginatePosProductsInput = {
    limit: input.limit,
    cursor: input.cursor,
  };

  return paginatePosProducts(products, paginationInput);
}

export async function toggleProductFavoriteViaZero({
  zeroDb,
  ctx,
  productId,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  productId: string;
}) {
  await zeroDb.transaction((tx) =>
    mutators.products.toggleFavorite.fn({
      args: { productId },
      ctx,
      tx,
    })
  );

  const [productRow] = await zeroDb.run(
    queries.products.posCatalog.fn({
      args: { limit: 1000 },
      ctx,
    })
  );
  const matchingProduct = productRow?.id === productId ? productRow : null;
  const resolvedProduct =
    matchingProduct ??
    (
      await zeroDb.run(queries.products.modifiers.fn({ args: undefined, ctx }))
    ).find((row) => row.id === productId);

  return {
    success: true,
    isFavorite: resolvedProduct?.isFavorite ?? false,
  };
}
