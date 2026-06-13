import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import type {
  AddRestaurantOrderItemInputSchema,
  CloseRestaurantOrderInputSchema,
  CreateRestaurantAreaInputSchema,
  CreateRestaurantTableInputSchema,
  DeleteRestaurantAreaInputSchema,
  DeleteRestaurantTableInputSchema,
  SendRestaurantOrderToKitchenInputSchema,
  UpdateRestaurantAreaInputSchema,
  UpdateRestaurantTableInputSchema,
} from "@/features/restaurants/restaurants.schema";
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
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
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
    zeroDb.run(queries.organization.current.fn({ args: undefined, ctx })),
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
    zeroDb.run(queries.organization.current.fn({ args: undefined, ctx })),
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
    zeroDb.run(queries.organization.current.fn({ args: undefined, ctx })),
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
    zeroDb.run(queries.organization.current.fn({ args: undefined, ctx })),
    zeroDb.run(queries.restaurants.kitchenBoard.fn({ args: undefined, ctx })),
  ]);

  return buildKitchenBoard({
    organizationMetadata: organizationRows[0]?.metadata,
    tickets: ticketRows as RestaurantKitchenTicketRow[],
  });
}

type AddOrderItemInput = z.infer<typeof AddRestaurantOrderItemInputSchema>;
type SendToKitchenInput = z.infer<
  typeof SendRestaurantOrderToKitchenInputSchema
>;
type CloseOrderInput = z.infer<typeof CloseRestaurantOrderInputSchema>;
type CreateAreaInput = z.infer<typeof CreateRestaurantAreaInputSchema>;
type UpdateAreaInput = z.infer<typeof UpdateRestaurantAreaInputSchema>;
type UpdateTableInput = z.infer<typeof UpdateRestaurantTableInputSchema>;
type DeleteAreaInput = z.infer<typeof DeleteRestaurantAreaInputSchema>;
type CreateTableInput = z.infer<typeof CreateRestaurantTableInputSchema>;
type DeleteTableInput = z.infer<typeof DeleteRestaurantTableInputSchema>;

export async function addRestaurantOrderItemViaZero({
  db,
  zeroDb,
  ctx,
  input,
}: {
  db: Database;
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: AddOrderItemInput;
}) {
  const itemId = crypto.randomUUID();

  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.addOrderItem.fn({
      args: { ...input, itemId },
      ctx,
      tx,
    })
  );

  const [itemRow] = await db
    .select({
      id: restaurantOrderItem.id,
      orderId: restaurantOrderItem.orderId,
    })
    .from(restaurantOrderItem)
    .where(eq(restaurantOrderItem.id, itemId))
    .limit(1);

  if (!itemRow) {
    throw new Error(`Ítem no encontrado después de addOrderItem: ${itemId}`);
  }

  const [orderRow] = await db
    .select({ tableId: restaurantOrder.tableId })
    .from(restaurantOrder)
    .where(eq(restaurantOrder.id, itemRow.orderId))
    .limit(1);

  return {
    orderId: itemRow.orderId,
    itemId: itemRow.id,
    tableId: orderRow?.tableId ?? input.tableId,
  };
}

export async function sendRestaurantOrderToKitchenViaZero({
  db,
  zeroDb,
  ctx,
  input,
}: {
  db: Database;
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: SendToKitchenInput;
}) {
  const ticketId = crypto.randomUUID();

  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.sendToKitchen.fn({
      args: { ...input, ticketId },
      ctx,
      tx,
    })
  );

  const [ticketRow] = await db
    .select({
      id: restaurantKitchenTicket.id,
      orderId: restaurantKitchenTicket.orderId,
      sequenceNumber: restaurantKitchenTicket.sequenceNumber,
    })
    .from(restaurantKitchenTicket)
    .where(eq(restaurantKitchenTicket.id, ticketId))
    .limit(1);

  if (!ticketRow) {
    throw new Error(
      `Ticket no encontrado después de sendToKitchen: ${ticketId}`
    );
  }

  const itemRows = await db
    .select({ id: restaurantOrderItem.id })
    .from(restaurantOrderItem)
    .where(eq(restaurantOrderItem.kitchenTicketId, ticketId));

  return {
    ticket: {
      id: ticketRow.id,
      sequenceNumber: ticketRow.sequenceNumber,
      items: itemRows,
    },
  };
}

export async function closeRestaurantOrderViaZero({
  db,
  zeroDb,
  ctx,
  input,
}: {
  db: Database;
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CloseOrderInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.closeOrder.fn({
      args: input,
      ctx,
      tx,
    })
  );

  const [orderRow] = await db
    .select({ saleId: restaurantOrder.saleId })
    .from(restaurantOrder)
    .where(eq(restaurantOrder.id, input.orderId))
    .limit(1);

  if (!orderRow?.saleId) {
    throw new Error(
      `Venta no encontrada después de closeOrder: ${input.orderId}`
    );
  }

  const [saleRow] = await db
    .select({
      id: sale.id,
      status: sale.status,
      totalAmount: sale.totalAmount,
    })
    .from(sale)
    .where(eq(sale.id, orderRow.saleId))
    .limit(1);

  if (!saleRow) {
    throw new Error(
      `Venta no encontrada después de closeOrder: ${orderRow.saleId}`
    );
  }

  return {
    saleId: saleRow.id,
    status: saleRow.status,
    totalAmount: saleRow.totalAmount,
  };
}

export async function createRestaurantAreaViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CreateAreaInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.createArea.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}

export async function updateRestaurantAreaViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: UpdateAreaInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.updateArea.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}

export async function deleteRestaurantAreaViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: DeleteAreaInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.deleteArea.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}

export async function createRestaurantTableViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: CreateTableInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.createTable.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}

export async function updateRestaurantTableViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: UpdateTableInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.updateTable.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}

export async function deleteRestaurantTableViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: DeleteTableInput;
}) {
  await zeroDb.transaction((tx) =>
    serverMutators.restaurants.deleteTable.fn({ args: input, ctx, tx })
  );
  return getRestaurantConfigurationViaZero({ zeroDb, ctx });
}
