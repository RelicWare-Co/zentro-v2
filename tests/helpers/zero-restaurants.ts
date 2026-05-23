import {
  assertRestaurantModuleEnabled,
  buildKitchenBoard,
  buildRestaurantBootstrap,
  buildRestaurantConfiguration,
  buildRestaurantTableDetail,
  type RestaurantAreaRow,
  type RestaurantCategoryRow,
  type RestaurantKitchenTicketRow,
  type RestaurantOpenOrderRow,
  type RestaurantTableRow,
} from "@/features/restaurants/restaurants.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { queries } from "@/src/zero/queries";
import type { ZeroContext } from "@/src/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;

export async function getRestaurantBootstrapViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const [
    activeShiftRows,
    categoryRows,
    organizationRows,
    layoutRows,
    openOrderRows,
  ] = await Promise.all([
    zeroDb.run(queries.shifts.active.fn({ args: undefined, ctx })),
    zeroDb.run(queries.products.categories.fn({ args: undefined, ctx })),
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
    zeroDb.run(queries.restaurants.layout.fn({ args: undefined, ctx })),
    zeroDb.run(queries.restaurants.openOrders.fn({ args: undefined, ctx })),
  ]);

  return buildRestaurantBootstrap({
    activeShift: (activeShiftRows[0] ?? null) as Parameters<
      typeof buildRestaurantBootstrap
    >[0]["activeShift"],
    categories: categoryRows as RestaurantCategoryRow[],
    organizationMetadata: organizationRows[0]?.metadata,
    areas: layoutRows as RestaurantAreaRow[],
    openOrders: openOrderRows as RestaurantOpenOrderRow[],
  });
}

export async function getRestaurantConfigurationViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const [organizationRows, layoutRows] = await Promise.all([
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
    zeroDb.run(queries.restaurants.layout.fn({ args: undefined, ctx })),
  ]);
  return buildRestaurantConfiguration(
    layoutRows as RestaurantAreaRow[],
    organizationRows[0]?.metadata
  );
}

export async function getRestaurantTableDetailViaZero({
  zeroDb,
  ctx,
  tableId,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  tableId: string;
}) {
  const [organizationRows, tableRows, openOrderRows] = await Promise.all([
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
    zeroDb.run(
      queries.restaurants.tableById.fn({
        args: { tableId },
        ctx,
      })
    ),
    zeroDb.run(queries.restaurants.openOrders.fn({ args: undefined, ctx })),
  ]);

  assertRestaurantModuleEnabled(
    parseOrganizationSettingsMetadata(organizationRows[0]?.metadata)
  );

  const table = tableRows[0] as RestaurantTableRow | undefined;
  if (!table) {
    throw new Error("La mesa no existe en la organización activa.");
  }

  const openOrder =
    (openOrderRows as RestaurantOpenOrderRow[]).find(
      (orderRow) => orderRow.tableId === tableId
    ) ?? null;

  return buildRestaurantTableDetail({
    organizationMetadata: organizationRows[0]?.metadata,
    table,
    openOrder,
  });
}

export async function getKitchenBoardViaZero({
  zeroDb,
  ctx,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
}) {
  const [organizationRows, ticketRows] = await Promise.all([
    zeroDb.run(queries.shifts.organization.fn({ args: undefined, ctx })),
    zeroDb.run(queries.restaurants.kitchenBoard.fn({ args: undefined, ctx })),
  ]);

  return buildKitchenBoard({
    organizationMetadata: organizationRows[0]?.metadata,
    tickets: ticketRows as RestaurantKitchenTicketRow[],
  });
}
