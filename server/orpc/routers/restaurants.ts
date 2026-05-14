import { implement, ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { dbSqlite } from "../../../database/drizzle/db";
import {
  member,
  organization,
} from "../../../database/drizzle/schema/auth.schema";
import {
  category,
  product,
} from "../../../database/drizzle/schema/inventory.schema";
import { shift } from "../../../database/drizzle/schema/pos.schema";
import {
  restaurantArea,
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
  restaurantTable,
} from "../../../database/drizzle/schema/restaurant.schema";
import { getRestaurantModuleSettings } from "../../../features/restaurants/restaurants.module";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import { isOrganizationManagerRole } from "../../organization/access-control.shared";
import { createCoreSale } from "../../sales/create-sale.server";
import type { AppContext } from "../context";
import { restaurantsContract } from "../contracts/restaurants";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const restaurantsImplementer =
  implement(restaurantsContract).$context<AppContext>();

const orgRequiredProcedure = restaurantsImplementer
  .use(dbMiddleware)
  .use(authMiddleware)
  .use(requireOrgMiddleware);

type RestaurantDb = ReturnType<typeof dbSqlite>;
type RestaurantTransaction = Parameters<
  Parameters<RestaurantDb["transaction"]>[0]
>[0];
type RestaurantDatabase = RestaurantDb | RestaurantTransaction;

function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" es obligatorio`,
    });
  }
  return normalized;
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`,
    });
  }
  return Math.round(value);
}

function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" debe ser un número válido mayor a 0`,
    });
  }
  return normalized;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

async function assertManagerAccess(context: {
  db: RestaurantDatabase | RestaurantTransaction;
  organizationId: string;
  user: { id: string };
}) {
  const [memberRow] = await context.db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, context.organizationId),
        eq(member.userId, context.user.id)
      )
    )
    .limit(1);

  if (!(memberRow && isOrganizationManagerRole(memberRow.role))) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Esta acción requiere permisos de administrador de la organización.",
    });
  }
}

async function requireRestaurantModuleAccess(context: {
  db: RestaurantDatabase | RestaurantTransaction;
  organizationId: string;
}) {
  const [orgRow] = await context.db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, context.organizationId))
    .limit(1);

  const settings = parseOrganizationSettingsMetadata(orgRow?.metadata);
  const _moduleSettings = getRestaurantModuleSettings(settings);

  if (!settings.modules.restaurants.enabled) {
    throw new ORPCError("FORBIDDEN", {
      message: "El módulo de restaurantes no está habilitado.",
    });
  }
}

function calculateModifierTotal(
  baseQuantity: number,
  modifiers: Array<{ quantity: number; unitPrice: number }>
) {
  let total = 0;
  for (const modifier of modifiers) {
    total += baseQuantity * modifier.quantity * modifier.unitPrice;
  }
  return total;
}

function buildOrderSummary(
  items: Array<{
    status: string;
    quantity: number;
    totalAmount: number;
  }>
) {
  let itemCount = 0;
  let totalAmount = 0;
  let draftItemsCount = 0;
  let readyItemsCount = 0;
  let servedItemsCount = 0;

  for (const item of items) {
    if (item.status === "cancelled") {
      continue;
    }
    itemCount += item.quantity;
    totalAmount += item.totalAmount;
    if (item.status === "draft") {
      draftItemsCount += item.quantity;
    }
    if (item.status === "ready") {
      readyItemsCount += item.quantity;
    }
    if (item.status === "served") {
      servedItemsCount += item.quantity;
    }
  }

  return {
    itemCount,
    totalAmount,
    draftItemsCount,
    readyItemsCount,
    servedItemsCount,
  };
}

async function getLayoutRows(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string
) {
  const [areas, tables] = await Promise.all([
    database
      .select({
        id: restaurantArea.id,
        name: restaurantArea.name,
        sortOrder: restaurantArea.sortOrder,
      })
      .from(restaurantArea)
      .where(eq(restaurantArea.organizationId, organizationId))
      .orderBy(asc(restaurantArea.sortOrder), asc(restaurantArea.name)),
    database
      .select({
        id: restaurantTable.id,
        areaId: restaurantTable.areaId,
        name: restaurantTable.name,
        seats: restaurantTable.seats,
        sortOrder: restaurantTable.sortOrder,
        isActive: restaurantTable.isActive,
      })
      .from(restaurantTable)
      .where(eq(restaurantTable.organizationId, organizationId))
      .orderBy(asc(restaurantTable.sortOrder), asc(restaurantTable.name)),
  ]);

  return { areas, tables };
}

interface TableShape<OpenOrder = unknown> {
  areaId: string;
  id: string;
  isActive: boolean;
  name: string;
  openOrder: OpenOrder;
  seats: number;
  sortOrder: number;
}

function groupAreasWithTables<OpenOrder = unknown>(
  areas: Array<{ id: string; name: string; sortOrder: number }>,
  tables: TableShape<OpenOrder>[]
): Array<{
  id: string;
  name: string;
  sortOrder: number;
  tables: TableShape<OpenOrder>[];
}> {
  const tablesByAreaId = new Map<string, TableShape<OpenOrder>[]>();
  for (const table of tables) {
    const collection = tablesByAreaId.get(table.areaId) ?? [];
    collection.push(table);
    tablesByAreaId.set(table.areaId, collection);
  }

  return areas.map((area) => ({
    ...area,
    tables: (tablesByAreaId.get(area.id) ?? []).toSorted(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "es-CO")
    ),
  }));
}

async function assertAreaFromOrganization(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  areaId: string
) {
  const [row] = await database
    .select({
      id: restaurantArea.id,
      name: restaurantArea.name,
    })
    .from(restaurantArea)
    .where(
      and(
        eq(restaurantArea.organizationId, organizationId),
        eq(restaurantArea.id, areaId)
      )
    )
    .limit(1);

  if (!row) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La zona no existe en la organización activa.",
    });
  }

  return row;
}

async function assertTableFromOrganization(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  tableId: string
) {
  const [row] = await database
    .select({
      id: restaurantTable.id,
      areaId: restaurantTable.areaId,
      name: restaurantTable.name,
      seats: restaurantTable.seats,
      isActive: restaurantTable.isActive,
      areaName: restaurantArea.name,
    })
    .from(restaurantTable)
    .innerJoin(restaurantArea, eq(restaurantTable.areaId, restaurantArea.id))
    .where(
      and(
        eq(restaurantTable.organizationId, organizationId),
        eq(restaurantTable.id, tableId)
      )
    )
    .limit(1);

  if (!row) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La mesa no existe en la organización activa.",
    });
  }

  return row;
}

async function getOpenOrderForTable(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  tableId: string
) {
  const [row] = await database
    .select({
      id: restaurantOrder.id,
      tableId: restaurantOrder.tableId,
      orderNumber: restaurantOrder.orderNumber,
      status: restaurantOrder.status,
      guestCount: restaurantOrder.guestCount,
      notes: restaurantOrder.notes,
      createdAt: restaurantOrder.createdAt,
      updatedAt: restaurantOrder.updatedAt,
    })
    .from(restaurantOrder)
    .where(
      and(
        eq(restaurantOrder.organizationId, organizationId),
        eq(restaurantOrder.tableId, tableId),
        eq(restaurantOrder.status, "open")
      )
    )
    .orderBy(desc(restaurantOrder.createdAt))
    .limit(1);

  return row ?? null;
}

async function getOpenOrderById(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  orderId: string
) {
  const [row] = await database
    .select({
      id: restaurantOrder.id,
      tableId: restaurantOrder.tableId,
      orderNumber: restaurantOrder.orderNumber,
      status: restaurantOrder.status,
      guestCount: restaurantOrder.guestCount,
      notes: restaurantOrder.notes,
      createdAt: restaurantOrder.createdAt,
      updatedAt: restaurantOrder.updatedAt,
    })
    .from(restaurantOrder)
    .where(
      and(
        eq(restaurantOrder.organizationId, organizationId),
        eq(restaurantOrder.id, orderId),
        eq(restaurantOrder.status, "open")
      )
    )
    .limit(1);

  if (!row) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La cuenta no existe o ya no está abierta.",
    });
  }

  return row;
}

async function getNextOrderNumber(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string
) {
  const [row] = await database
    .select({ orderNumber: restaurantOrder.orderNumber })
    .from(restaurantOrder)
    .where(eq(restaurantOrder.organizationId, organizationId))
    .orderBy(desc(restaurantOrder.orderNumber))
    .limit(1);

  return (row?.orderNumber ?? 0) + 1;
}

async function getNextAreaSortOrder(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string
) {
  const [row] = await database
    .select({ sortOrder: restaurantArea.sortOrder })
    .from(restaurantArea)
    .where(eq(restaurantArea.organizationId, organizationId))
    .orderBy(desc(restaurantArea.sortOrder))
    .limit(1);

  return (row?.sortOrder ?? -1) + 1;
}

async function getNextTableSortOrder(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  areaId: string
) {
  const [row] = await database
    .select({ sortOrder: restaurantTable.sortOrder })
    .from(restaurantTable)
    .where(
      and(
        eq(restaurantTable.organizationId, organizationId),
        eq(restaurantTable.areaId, areaId)
      )
    )
    .orderBy(desc(restaurantTable.sortOrder))
    .limit(1);

  return (row?.sortOrder ?? -1) + 1;
}

async function getOrCreateOpenOrderForTable(input: {
  database: RestaurantDatabase | RestaurantTransaction;
  organizationId: string;
  tableId: string;
  userId: string;
}) {
  const existingOrder = await getOpenOrderForTable(
    input.database,
    input.organizationId,
    input.tableId
  );
  if (existingOrder) {
    return existingOrder;
  }

  const now = new Date();
  const orderId = crypto.randomUUID();
  const orderNumber = await getNextOrderNumber(
    input.database,
    input.organizationId
  );

  await input.database.insert(restaurantOrder).values({
    id: orderId,
    organizationId: input.organizationId,
    tableId: input.tableId,
    openedByUserId: input.userId,
    closedByUserId: null,
    saleId: null,
    orderNumber,
    status: "open",
    guestCount: 0,
    notes: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  });

  return {
    id: orderId,
    tableId: input.tableId,
    orderNumber,
    status: "open" as const,
    guestCount: 0,
    notes: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
}

async function getProductSnapshot(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  productIds: string[]
) {
  if (productIds.length === 0) {
    return new Map<
      string,
      {
        id: string;
        name: string;
        price: number;
        taxRate: number;
        isModifier: boolean;
      }
    >();
  }

  const rows = await database
    .select({
      id: product.id,
      name: product.name,
      price: product.price,
      taxRate: product.taxRate,
      isModifier: product.isModifier,
    })
    .from(product)
    .where(
      and(
        eq(product.organizationId, organizationId),
        isNull(product.deletedAt),
        inArray(product.id, productIds)
      )
    );

  return new Map(rows.map((row) => [row.id, row]));
}

async function getOrderItemsWithModifiers(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  orderId: string
) {
  const itemRows = await database
    .select({
      id: restaurantOrderItem.id,
      orderId: restaurantOrderItem.orderId,
      productId: restaurantOrderItem.productId,
      kitchenTicketId: restaurantOrderItem.kitchenTicketId,
      quantity: restaurantOrderItem.quantity,
      unitPrice: restaurantOrderItem.unitPrice,
      taxRate: restaurantOrderItem.taxRate,
      discountAmount: restaurantOrderItem.discountAmount,
      notes: restaurantOrderItem.notes,
      status: restaurantOrderItem.status,
      createdAt: restaurantOrderItem.createdAt,
      updatedAt: restaurantOrderItem.updatedAt,
      sentAt: restaurantOrderItem.sentAt,
      readyAt: restaurantOrderItem.readyAt,
      servedAt: restaurantOrderItem.servedAt,
      cancelledAt: restaurantOrderItem.cancelledAt,
      productName: product.name,
    })
    .from(restaurantOrderItem)
    .innerJoin(product, eq(restaurantOrderItem.productId, product.id))
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.orderId, orderId)
      )
    )
    .orderBy(asc(restaurantOrderItem.createdAt), asc(restaurantOrderItem.id));

  const itemIds = itemRows.map((item) => item.id);
  const modifierRows =
    itemIds.length > 0
      ? await database
          .select({
            id: restaurantOrderItemModifier.id,
            orderItemId: restaurantOrderItemModifier.orderItemId,
            modifierProductId: restaurantOrderItemModifier.modifierProductId,
            quantity: restaurantOrderItemModifier.quantity,
            unitPrice: restaurantOrderItemModifier.unitPrice,
            name: product.name,
          })
          .from(restaurantOrderItemModifier)
          .innerJoin(
            product,
            eq(restaurantOrderItemModifier.modifierProductId, product.id)
          )
          .where(
            and(
              eq(restaurantOrderItemModifier.organizationId, organizationId),
              inArray(restaurantOrderItemModifier.orderItemId, itemIds)
            )
          )
          .orderBy(
            asc(restaurantOrderItemModifier.orderItemId),
            asc(restaurantOrderItemModifier.id)
          )
      : [];

  const modifiersByItemId = new Map<
    string,
    Array<{
      id: string;
      modifierProductId: string;
      quantity: number;
      unitPrice: number;
      name: string;
    }>
  >();

  for (const modifierRow of modifierRows) {
    const collection = modifiersByItemId.get(modifierRow.orderItemId) ?? [];
    collection.push({
      id: modifierRow.id,
      modifierProductId: modifierRow.modifierProductId,
      quantity: modifierRow.quantity,
      unitPrice: modifierRow.unitPrice,
      name: modifierRow.name,
    });
    modifiersByItemId.set(modifierRow.orderItemId, collection);
  }

  return itemRows.map((itemRow) => {
    const modifiers = modifiersByItemId.get(itemRow.id) ?? [];
    const modifiersTotal = calculateModifierTotal(itemRow.quantity, modifiers);
    const baseSubtotal = itemRow.quantity * itemRow.unitPrice;
    return {
      id: itemRow.id,
      orderId: itemRow.orderId,
      productId: itemRow.productId,
      productName: itemRow.productName,
      kitchenTicketId: itemRow.kitchenTicketId,
      quantity: itemRow.quantity,
      unitPrice: itemRow.unitPrice,
      taxRate: itemRow.taxRate,
      discountAmount: itemRow.discountAmount,
      notes: itemRow.notes,
      status: itemRow.status,
      modifiers,
      baseSubtotal,
      modifiersTotal,
      totalAmount: baseSubtotal + modifiersTotal - itemRow.discountAmount,
      createdAt: toTimestamp(itemRow.createdAt),
      updatedAt: toTimestamp(itemRow.updatedAt),
      sentAt: toTimestamp(itemRow.sentAt),
      readyAt: toTimestamp(itemRow.readyAt),
      servedAt: toTimestamp(itemRow.servedAt),
      cancelledAt: toTimestamp(itemRow.cancelledAt),
    };
  });
}

async function getKitchenTicketsForOrder(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  orderId: string
) {
  const rows = await database
    .select({
      id: restaurantKitchenTicket.id,
      sequenceNumber: restaurantKitchenTicket.sequenceNumber,
      status: restaurantKitchenTicket.status,
      createdAt: restaurantKitchenTicket.createdAt,
      printedAt: restaurantKitchenTicket.printedAt,
    })
    .from(restaurantKitchenTicket)
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, organizationId),
        eq(restaurantKitchenTicket.orderId, orderId)
      )
    )
    .orderBy(desc(restaurantKitchenTicket.sequenceNumber));

  return rows.map((row) => ({
    ...row,
    createdAt: toTimestamp(row.createdAt),
    printedAt: toTimestamp(row.printedAt),
  }));
}

async function refreshKitchenTicketStatus(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string,
  ticketId: string
) {
  const ticketItems = await database
    .select({ status: restaurantOrderItem.status })
    .from(restaurantOrderItem)
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.kitchenTicketId, ticketId)
      )
    );

  if (ticketItems.length === 0) {
    return;
  }

  const activeStatuses = ticketItems.reduce<string[]>((acc, item) => {
    if (item.status !== "cancelled") {
      acc.push(item.status);
    }
    return acc;
  }, []);
  let nextStatus: "served" | "ready" | "sent";
  if (activeStatuses.every((status) => status === "served")) {
    nextStatus = "served";
  } else if (
    activeStatuses.every((status) => status === "ready" || status === "served")
  ) {
    nextStatus = "ready";
  } else {
    nextStatus = "sent";
  }

  await database
    .update(restaurantKitchenTicket)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(restaurantKitchenTicket.organizationId, organizationId),
        eq(restaurantKitchenTicket.id, ticketId)
      )
    );
}

async function getRestaurantConfigurationFromDb(
  database: RestaurantDatabase | RestaurantTransaction,
  organizationId: string
) {
  const { areas, tables } = await getLayoutRows(database, organizationId);
  return groupAreasWithTables<null>(
    areas,
    tables.map((table) => ({ ...table, openOrder: null }))
  );
}

export const bootstrap = orgRequiredProcedure.bootstrap.handler(
  async ({ context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;

    const [
      activeShiftRows,
      categories,
      organizationRows,
      layoutRows,
      openOrderRows,
    ] = await Promise.all([
      context.db
        .select({
          id: shift.id,
          terminalId: shift.terminalId,
          terminalName: shift.terminalName,
          status: shift.status,
          startingCash: shift.startingCash,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
          notes: shift.notes,
        })
        .from(shift)
        .where(
          and(
            eq(shift.organizationId, organizationId),
            eq(shift.userId, context.user.id),
            eq(shift.status, "open")
          )
        )
        .orderBy(desc(shift.openedAt))
        .limit(1),
      context.db
        .select({
          id: category.id,
          name: category.name,
        })
        .from(category)
        .where(eq(category.organizationId, organizationId))
        .orderBy(asc(category.name)),
      context.db
        .select({ metadata: organization.metadata })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
      getLayoutRows(context.db, organizationId),
      context.db
        .select({
          id: restaurantOrder.id,
          tableId: restaurantOrder.tableId,
          orderNumber: restaurantOrder.orderNumber,
        })
        .from(restaurantOrder)
        .where(
          and(
            eq(restaurantOrder.organizationId, organizationId),
            eq(restaurantOrder.status, "open")
          )
        ),
    ]);

    const activeShift = activeShiftRows[0] ?? null;
    const organizationSettings = parseOrganizationSettingsMetadata(
      organizationRows[0]?.metadata
    );
    const paymentMethods = getEnabledPaymentMethods(organizationSettings).map(
      (paymentMethod) => ({
        id: paymentMethod.id,
        label: paymentMethod.label,
        requiresReference: paymentMethod.requiresReference,
      })
    );

    const itemGroups = await Promise.all(
      openOrderRows.map((orderRow) =>
        getOrderItemsWithModifiers(
          context.db,
          organizationId,
          orderRow.id
        ).then((items) => [orderRow.id, items] as const)
      )
    );

    const summaryByOrderId = new Map<
      string,
      ReturnType<typeof buildOrderSummary>
    >();
    for (const [orderId, items] of itemGroups) {
      summaryByOrderId.set(orderId, buildOrderSummary(items));
    }

    const openOrderByTableId = new Map<
      string,
      {
        id: string;
        orderNumber: number;
        itemCount: number;
        totalAmount: number;
        draftItemsCount: number;
        readyItemsCount: number;
        servedItemsCount: number;
      }
    >();

    for (const orderRow of openOrderRows) {
      const summary = summaryByOrderId.get(orderRow.id);
      if (!summary) {
        continue;
      }
      openOrderByTableId.set(orderRow.tableId, {
        id: orderRow.id,
        orderNumber: orderRow.orderNumber,
        ...summary,
      });
    }

    return {
      activeShift: activeShift
        ? {
            ...activeShift,
            openedAt: toTimestamp(activeShift.openedAt),
            closedAt: toTimestamp(activeShift.closedAt),
          }
        : null,
      categories: categories.reduce<
        Array<{ id: string; name: string; description: string | null }>
      >((acc, c) => {
        if (c.id && c.name) {
          acc.push({ ...c, description: null });
        }
        return acc;
      }, []),
      settings: {
        paymentMethods,
        defaultTerminalName: organizationSettings.pos.defaultTerminalName,
        restaurant: getRestaurantModuleSettings(organizationSettings),
      },
      areas: groupAreasWithTables(
        layoutRows.areas,
        layoutRows.tables.map((table) => ({
          ...table,
          openOrder: openOrderByTableId.get(table.id) ?? null,
        }))
      ),
    };
  }
);

export const tableDetail = orgRequiredProcedure.tableDetail.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const [table, openOrder] = await Promise.all([
      assertTableFromOrganization(context.db, organizationId, input.tableId),
      getOpenOrderForTable(context.db, organizationId, input.tableId),
    ]);

    if (!openOrder) {
      return {
        table: {
          ...table,
        },
        openOrder: null,
      };
    }

    const [items, tickets] = await Promise.all([
      getOrderItemsWithModifiers(context.db, organizationId, openOrder.id),
      getKitchenTicketsForOrder(context.db, organizationId, openOrder.id),
    ]);

    return {
      table: {
        ...table,
      },
      openOrder: {
        id: openOrder.id,
        orderNumber: openOrder.orderNumber,
        guestCount: openOrder.guestCount,
        notes: openOrder.notes,
        createdAt: toTimestamp(openOrder.createdAt),
        updatedAt: toTimestamp(openOrder.updatedAt),
        items,
        tickets,
        totals: buildOrderSummary(items),
      },
    };
  }
);

export const addOrderItem = orgRequiredProcedure.addOrderItem.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const tableId = normalizeRequiredString(input.tableId, "tableId");
    const productId = normalizeRequiredString(input.productId, "productId");
    const quantity = toPositiveInteger(input.quantity, "quantity");
    const notes = normalizeOptionalString(input.notes);
    const modifierProductIds = [
      ...new Set(input.modifierProductIds ?? []),
    ].filter(Boolean);

    return context.db.transaction(async (tx) => {
      const database = tx;
      const table = await assertTableFromOrganization(
        database,
        organizationId,
        tableId
      );
      if (!table.isActive) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No puedes registrar órdenes en una mesa inactiva.",
        });
      }

      const productSnapshot = await getProductSnapshot(
        database,
        organizationId,
        [productId, ...modifierProductIds]
      );
      const baseProduct = productSnapshot.get(productId);
      if (!baseProduct || baseProduct.isModifier) {
        throw new ORPCError("BAD_REQUEST", {
          message: "El producto seleccionado no es válido para el menú.",
        });
      }

      for (const modifierProductId of modifierProductIds) {
        const modifierProduct = productSnapshot.get(modifierProductId);
        if (!modifierProduct?.isModifier) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Uno de los modificadores no es válido.",
          });
        }
      }

      const order = await getOrCreateOpenOrderForTable({
        database,
        organizationId,
        tableId,
        userId: context.user.id,
      });
      const now = new Date();
      const itemId = crypto.randomUUID();

      await database.insert(restaurantOrderItem).values({
        id: itemId,
        organizationId,
        orderId: order.id,
        kitchenTicketId: null,
        productId,
        quantity,
        unitPrice: baseProduct.price,
        taxRate: baseProduct.taxRate,
        discountAmount: 0,
        notes,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        sentAt: null,
        readyAt: null,
        servedAt: null,
        cancelledAt: null,
      });

      if (modifierProductIds.length > 0) {
        await database.insert(restaurantOrderItemModifier).values(
          modifierProductIds.map((modifierProductId) => ({
            id: crypto.randomUUID(),
            organizationId,
            orderItemId: itemId,
            modifierProductId,
            quantity: 1,
            unitPrice: productSnapshot.get(modifierProductId)?.price ?? 0,
            createdAt: now,
          }))
        );
      }

      await database
        .update(restaurantOrder)
        .set({ updatedAt: now })
        .where(eq(restaurantOrder.id, order.id));

      return { orderId: order.id, itemId, tableId };
    });
  }
);

export const updateOrderMeta = orgRequiredProcedure.updateOrderMeta.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const order = await getOpenOrderById(
      context.db,
      organizationId,
      input.orderId
    );

    const updates: Partial<typeof restaurantOrder.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.guestCount !== undefined) {
      updates.guestCount = toNonNegativeInteger(input.guestCount, "guestCount");
    }
    if (input.notes !== undefined) {
      updates.notes = normalizeOptionalString(input.notes);
    }

    await context.db
      .update(restaurantOrder)
      .set(updates)
      .where(eq(restaurantOrder.id, order.id));

    return { success: true };
  }
);

export const updateDraftItem = orgRequiredProcedure.updateDraftItem.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const quantity = toPositiveInteger(input.quantity, "quantity");
    const notes =
      input.notes === undefined
        ? undefined
        : normalizeOptionalString(input.notes);

    const [itemRow] = await context.db
      .select({
        id: restaurantOrderItem.id,
        status: restaurantOrderItem.status,
        orderId: restaurantOrderItem.orderId,
      })
      .from(restaurantOrderItem)
      .where(
        and(
          eq(restaurantOrderItem.organizationId, organizationId),
          eq(restaurantOrderItem.id, input.orderItemId)
        )
      )
      .limit(1);

    if (!itemRow) {
      throw new ORPCError("BAD_REQUEST", {
        message: "El ítem no existe en la organización activa.",
      });
    }
    if (itemRow.status !== "draft") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Solo puedes editar ítems que aún no fueron enviados.",
      });
    }

    await context.db
      .update(restaurantOrderItem)
      .set({
        quantity,
        ...(notes === undefined ? {} : { notes }),
        updatedAt: new Date(),
      })
      .where(eq(restaurantOrderItem.id, itemRow.id));

    return { success: true, orderId: itemRow.orderId };
  }
);

export const deleteDraftItem = orgRequiredProcedure.deleteDraftItem.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const [itemRow] = await context.db
      .select({
        id: restaurantOrderItem.id,
        orderId: restaurantOrderItem.orderId,
        status: restaurantOrderItem.status,
      })
      .from(restaurantOrderItem)
      .where(
        and(
          eq(restaurantOrderItem.organizationId, organizationId),
          eq(restaurantOrderItem.id, input.orderItemId)
        )
      )
      .limit(1);

    if (!itemRow) {
      throw new ORPCError("BAD_REQUEST", {
        message: "El ítem no existe en la organización activa.",
      });
    }
    if (itemRow.status !== "draft") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Solo puedes eliminar ítems que aún no fueron enviados.",
      });
    }

    return context.db.transaction(async (tx) => {
      const database = tx;
      await database
        .delete(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, itemRow.id));

      const [remainingRow] = await database
        .select({ id: restaurantOrderItem.id })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, itemRow.orderId))
        .limit(1);

      if (remainingRow) {
        await database
          .update(restaurantOrder)
          .set({ updatedAt: new Date() })
          .where(eq(restaurantOrder.id, itemRow.orderId));
      } else {
        await database
          .delete(restaurantOrder)
          .where(eq(restaurantOrder.id, itemRow.orderId));
      }

      return { success: true, orderId: itemRow.orderId };
    });
  }
);

export const sendToKitchen = orgRequiredProcedure.sendToKitchen.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const [orgRow] = await context.db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    const settings = getRestaurantModuleSettings(
      parseOrganizationSettingsMetadata(orgRow?.metadata)
    );

    return context.db.transaction(async (tx) => {
      const database = tx;
      const order = await getOpenOrderById(
        database,
        organizationId,
        input.orderId
      );
      const [table, items] = await Promise.all([
        assertTableFromOrganization(database, organizationId, order.tableId),
        getOrderItemsWithModifiers(database, organizationId, order.id),
      ]);
      const draftItems = items.filter((item) => item.status === "draft");
      if (draftItems.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No hay ítems pendientes por enviar a cocina.",
        });
      }

      const [lastTicket] = await database
        .select({ sequenceNumber: restaurantKitchenTicket.sequenceNumber })
        .from(restaurantKitchenTicket)
        .where(
          and(
            eq(restaurantKitchenTicket.organizationId, organizationId),
            eq(restaurantKitchenTicket.orderId, order.id)
          )
        )
        .orderBy(desc(restaurantKitchenTicket.sequenceNumber))
        .limit(1);
      const now = new Date();
      const ticketId = crypto.randomUUID();
      const sequenceNumber = (lastTicket?.sequenceNumber ?? 0) + 1;

      await database.insert(restaurantKitchenTicket).values({
        id: ticketId,
        organizationId,
        orderId: order.id,
        createdByUserId: context.user.id,
        sequenceNumber,
        status: "sent",
        createdAt: now,
        updatedAt: now,
        printedAt: null,
      });

      await Promise.all([
        database
          .update(restaurantOrderItem)
          .set({
            kitchenTicketId: ticketId,
            status: "sent",
            sentAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(restaurantOrderItem.organizationId, organizationId),
              eq(restaurantOrderItem.orderId, order.id),
              eq(restaurantOrderItem.status, "draft")
            )
          ),
        database
          .update(restaurantOrder)
          .set({ updatedAt: now })
          .where(eq(restaurantOrder.id, order.id)),
      ]);

      return {
        ticket: {
          id: ticketId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          sequenceNumber,
          createdAt: now.getTime(),
          table: {
            id: table.id,
            name: table.name,
            areaName: table.areaName,
          },
          items: draftItems,
        },
        printing: {
          enabled: settings.kitchen.printTicketsEnabled,
          autoPrintOnSend: settings.kitchen.autoPrintOnSend,
        },
      };
    });
  }
);

export const updateItemStatus = orgRequiredProcedure.updateItemStatus.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const [itemRow] = await context.db
      .select({
        id: restaurantOrderItem.id,
        status: restaurantOrderItem.status,
        kitchenTicketId: restaurantOrderItem.kitchenTicketId,
      })
      .from(restaurantOrderItem)
      .where(
        and(
          eq(restaurantOrderItem.organizationId, organizationId),
          eq(restaurantOrderItem.id, input.orderItemId)
        )
      )
      .limit(1);

    if (!itemRow) {
      throw new ORPCError("BAD_REQUEST", {
        message: "El ítem no existe en la organización activa.",
      });
    }
    if (itemRow.status === "draft" || itemRow.status === "cancelled") {
      throw new ORPCError("BAD_REQUEST", {
        message: "El ítem aún no puede cambiar a ese estado.",
      });
    }

    const now = new Date();
    await context.db
      .update(restaurantOrderItem)
      .set({
        status: input.status,
        readyAt: input.status === "ready" ? now : undefined,
        servedAt: input.status === "served" ? now : undefined,
        updatedAt: now,
      })
      .where(eq(restaurantOrderItem.id, itemRow.id));

    if (itemRow.kitchenTicketId) {
      await refreshKitchenTicketStatus(
        context.db,
        organizationId,
        itemRow.kitchenTicketId
      );
    }

    return { success: true };
  }
);

export const closeOrder = orgRequiredProcedure.closeOrder.handler(
  async ({ input, context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const order = await getOpenOrderById(
      context.db,
      organizationId,
      input.orderId
    );
    const items = await getOrderItemsWithModifiers(
      context.db,
      organizationId,
      order.id
    );
    const activeItems = items.filter((item) => item.status !== "cancelled");

    if (activeItems.length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No puedes cerrar una mesa sin ítems activos.",
      });
    }

    const saleResult = await createCoreSale(
      {
        shiftId: normalizeRequiredString(input.shiftId, "shiftId"),
        customerId: normalizeOptionalString(input.customerId),
        items: activeItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountAmount: item.discountAmount,
          modifiers: item.modifiers.map((modifier) => ({
            modifierProductId: modifier.modifierProductId,
            quantity: modifier.quantity,
            unitPrice: modifier.unitPrice,
          })),
        })),
        payments: input.payments,
      },
      {
        db: context.db,
        organizationId,
        userId: context.user.id,
      }
    );

    const now = new Date();
    const ticketIds = [
      ...new Set(
        activeItems.reduce<string[]>((acc, item) => {
          if (item.kitchenTicketId) {
            acc.push(item.kitchenTicketId);
          }
          return acc;
        }, [])
      ),
    ];

    await Promise.all([
      context.db
        .update(restaurantOrder)
        .set({
          status: "closed",
          closedByUserId: context.user.id,
          closedAt: now,
          saleId: saleResult.saleId,
          updatedAt: now,
        })
        .where(eq(restaurantOrder.id, order.id)),
      context.db
        .update(restaurantOrderItem)
        .set({
          status: "served",
          servedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(restaurantOrderItem.organizationId, organizationId),
            eq(restaurantOrderItem.orderId, order.id),
            isNull(restaurantOrderItem.cancelledAt)
          )
        ),
      ...(ticketIds.length > 0
        ? [
            context.db
              .update(restaurantKitchenTicket)
              .set({
                status: "served",
                updatedAt: now,
              })
              .where(
                and(
                  eq(restaurantKitchenTicket.organizationId, organizationId),
                  inArray(restaurantKitchenTicket.id, ticketIds)
                )
              ),
          ]
        : []),
    ]);

    return saleResult;
  }
);

export const configuration = orgRequiredProcedure.configuration.handler(
  async ({ context }) => {
    await requireRestaurantModuleAccess(context);
    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const createArea = orgRequiredProcedure.createArea.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    const name = normalizeRequiredString(input.name, "name");
    const now = new Date();

    await context.db.insert(restaurantArea).values({
      id: crypto.randomUUID(),
      organizationId: context.organizationId,
      name,
      sortOrder: await getNextAreaSortOrder(context.db, context.organizationId),
      createdAt: now,
      updatedAt: now,
    });

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const updateArea = orgRequiredProcedure.updateArea.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    const updates: Partial<typeof restaurantArea.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) {
      updates.name = normalizeRequiredString(input.name, "name");
    }

    await assertAreaFromOrganization(
      context.db,
      context.organizationId,
      input.id
    );
    await context.db
      .update(restaurantArea)
      .set(updates)
      .where(eq(restaurantArea.id, input.id));

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const deleteArea = orgRequiredProcedure.deleteArea.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    const [tableRow] = await context.db
      .select({ id: restaurantTable.id })
      .from(restaurantTable)
      .where(
        and(
          eq(restaurantTable.organizationId, context.organizationId),
          eq(restaurantTable.areaId, input.id)
        )
      )
      .limit(1);

    if (tableRow) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No puedes eliminar una zona que aún tiene mesas.",
      });
    }

    await context.db
      .delete(restaurantArea)
      .where(
        and(
          eq(restaurantArea.organizationId, context.organizationId),
          eq(restaurantArea.id, input.id)
        )
      );

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const createTable = orgRequiredProcedure.createTable.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    const area = await assertAreaFromOrganization(
      context.db,
      context.organizationId,
      input.areaId
    );
    const name = normalizeRequiredString(input.name, "name");
    const seats = toNonNegativeInteger(input.seats ?? 0, "seats");
    const now = new Date();

    await context.db.insert(restaurantTable).values({
      id: crypto.randomUUID(),
      organizationId: context.organizationId,
      areaId: area.id,
      name,
      seats,
      sortOrder: await getNextTableSortOrder(
        context.db,
        context.organizationId,
        area.id
      ),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const updateTable = orgRequiredProcedure.updateTable.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    await assertTableFromOrganization(
      context.db,
      context.organizationId,
      input.id
    );
    const updates: Partial<typeof restaurantTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.areaId !== undefined) {
      const area = await assertAreaFromOrganization(
        context.db,
        context.organizationId,
        input.areaId
      );
      updates.areaId = area.id;
    }
    if (input.name !== undefined) {
      updates.name = normalizeRequiredString(input.name, "name");
    }
    if (input.seats !== undefined) {
      updates.seats = toNonNegativeInteger(input.seats, "seats");
    }
    if (input.isActive !== undefined) {
      updates.isActive = input.isActive;
    }

    await context.db
      .update(restaurantTable)
      .set(updates)
      .where(eq(restaurantTable.id, input.id));

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const deleteTable = orgRequiredProcedure.deleteTable.handler(
  async ({ input, context }) => {
    await assertManagerAccess(context);
    const [orderRow] = await context.db
      .select({ id: restaurantOrder.id })
      .from(restaurantOrder)
      .where(
        and(
          eq(restaurantOrder.organizationId, context.organizationId),
          eq(restaurantOrder.tableId, input.id)
        )
      )
      .limit(1);

    if (orderRow) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No puedes eliminar una mesa que ya tiene historial.",
      });
    }

    await context.db
      .delete(restaurantTable)
      .where(
        and(
          eq(restaurantTable.organizationId, context.organizationId),
          eq(restaurantTable.id, input.id)
        )
      );

    return getRestaurantConfigurationFromDb(context.db, context.organizationId);
  }
);

export const kitchenBoard = orgRequiredProcedure.kitchenBoard.handler(
  async ({ context }) => {
    await requireRestaurantModuleAccess(context);
    const organizationId = context.organizationId;
    const [orgRow] = await context.db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    const settings = getRestaurantModuleSettings(
      parseOrganizationSettingsMetadata(orgRow?.metadata)
    );
    if (!settings.kitchen.displayEnabled) {
      throw new ORPCError("FORBIDDEN", {
        message: "La vista de cocina no está habilitada.",
      });
    }

    const ticketRows = await context.db
      .select({
        id: restaurantKitchenTicket.id,
        orderId: restaurantKitchenTicket.orderId,
        sequenceNumber: restaurantKitchenTicket.sequenceNumber,
        status: restaurantKitchenTicket.status,
        createdAt: restaurantKitchenTicket.createdAt,
        orderNumber: restaurantOrder.orderNumber,
        tableId: restaurantTable.id,
        tableName: restaurantTable.name,
        areaName: restaurantArea.name,
      })
      .from(restaurantKitchenTicket)
      .innerJoin(
        restaurantOrder,
        eq(restaurantKitchenTicket.orderId, restaurantOrder.id)
      )
      .innerJoin(
        restaurantTable,
        eq(restaurantOrder.tableId, restaurantTable.id)
      )
      .innerJoin(restaurantArea, eq(restaurantTable.areaId, restaurantArea.id))
      .where(
        and(
          eq(restaurantKitchenTicket.organizationId, organizationId),
          eq(restaurantOrder.organizationId, organizationId),
          eq(restaurantOrder.status, "open")
        )
      )
      .orderBy(desc(restaurantKitchenTicket.createdAt));

    const ticketIds = ticketRows.map((ticket) => ticket.id);
    const itemRows =
      ticketIds.length > 0
        ? await context.db
            .select({
              id: restaurantOrderItem.id,
              kitchenTicketId: restaurantOrderItem.kitchenTicketId,
              productName: product.name,
              quantity: restaurantOrderItem.quantity,
              status: restaurantOrderItem.status,
              notes: restaurantOrderItem.notes,
            })
            .from(restaurantOrderItem)
            .innerJoin(product, eq(restaurantOrderItem.productId, product.id))
            .where(
              and(
                eq(restaurantOrderItem.organizationId, organizationId),
                inArray(restaurantOrderItem.kitchenTicketId, ticketIds),
                inArray(restaurantOrderItem.status, ["sent", "ready"])
              )
            )
            .orderBy(
              desc(restaurantOrderItem.createdAt),
              desc(restaurantOrderItem.id)
            )
        : [];

    const itemsByTicketId = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      if (!item.kitchenTicketId) {
        continue;
      }
      const collection = itemsByTicketId.get(item.kitchenTicketId) ?? [];
      collection.push(item);
      itemsByTicketId.set(item.kitchenTicketId, collection);
    }

    return {
      tickets: ticketRows.reduce<
        Array<{
          id: string;
          orderId: string;
          orderNumber: number;
          sequenceNumber: number;
          status: string;
          createdAt: number;
          table: { id: string; name: string; areaName: string };
          items: typeof itemRows;
        }>
      >((acc, ticketRow) => {
        const items = itemsByTicketId.get(ticketRow.id) ?? [];
        if (items.length > 0) {
          acc.push({
            id: ticketRow.id,
            orderId: ticketRow.orderId,
            orderNumber: ticketRow.orderNumber,
            sequenceNumber: ticketRow.sequenceNumber,
            status: ticketRow.status,
            createdAt: toTimestamp(ticketRow.createdAt),
            table: {
              id: ticketRow.tableId,
              name: ticketRow.tableName,
              areaName: ticketRow.areaName,
            },
            items,
          });
        }
        return acc;
      }, []),
    };
  }
);
