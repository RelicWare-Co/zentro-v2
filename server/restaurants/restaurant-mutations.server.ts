import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { member, organization } from "@/database/drizzle/schema/auth.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import {
  restaurantArea,
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
  restaurantTable,
} from "@/database/drizzle/schema/restaurant.schema";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants.module";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import type {
  AddRestaurantOrderItemInputSchema,
  CloseRestaurantOrderInputSchema,
  CreateRestaurantAreaInputSchema,
  CreateRestaurantTableInputSchema,
  DeleteRestaurantAreaInputSchema,
  DeleteRestaurantDraftItemInputSchema,
  DeleteRestaurantTableInputSchema,
  SendRestaurantOrderToKitchenInputSchema,
  UpdateRestaurantAreaInputSchema,
  UpdateRestaurantDraftItemInputSchema,
  UpdateRestaurantOrderItemStatusInputSchema,
  UpdateRestaurantOrderMetaInputSchema,
  UpdateRestaurantTableInputSchema,
} from "@/schemas/restaurants";
import { createCoreSale } from "@/server/sales/create-sale.server";

export type RestaurantDbExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

type RestaurantTransaction = Parameters<
  Parameters<RestaurantDbExecutor["transaction"]>[0]
>[0];
type RestaurantDatabase = RestaurantDbExecutor | RestaurantTransaction;

interface RestaurantAuth {
  organizationId: string;
  userId: string;
}

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
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }
  return normalized;
}

function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
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
    throw new Error(
      "Esta acción requiere permisos de administrador de la organización."
    );
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
    throw new Error("El módulo de restaurantes no está habilitado.");
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
    throw new Error("La zona no existe en la organización activa.");
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
    throw new Error("La mesa no existe en la organización activa.");
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
    throw new Error("La cuenta no existe o ya no está abierta.");
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

export async function runAddRestaurantOrderItem(
  db: RestaurantDbExecutor,
  args: z.infer<typeof AddRestaurantOrderItemInputSchema> & { itemId: string },
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const tableId = normalizeRequiredString(args.tableId, "tableId");
  const productId = normalizeRequiredString(args.productId, "productId");
  const quantity = toPositiveInteger(args.quantity, "quantity");
  const notes = normalizeOptionalString(args.notes);
  const modifierProductIds = [...new Set(args.modifierProductIds ?? [])].filter(
    Boolean
  );

  const database = db;
  const table = await assertTableFromOrganization(
    database,
    organizationId,
    tableId
  );
  if (!table.isActive) {
    throw new Error("No puedes registrar órdenes en una mesa inactiva.");
  }

  const productSnapshot = await getProductSnapshot(database, organizationId, [
    productId,
    ...modifierProductIds,
  ]);
  const baseProduct = productSnapshot.get(productId);
  if (!baseProduct || baseProduct.isModifier) {
    throw new Error("El producto seleccionado no es válido para el menú.");
  }

  for (const modifierProductId of modifierProductIds) {
    const modifierProduct = productSnapshot.get(modifierProductId);
    if (!modifierProduct?.isModifier) {
      throw new Error("Uno de los modificadores no es válido.");
    }
  }

  const order = await getOrCreateOpenOrderForTable({
    database,
    organizationId,
    tableId,
    userId: auth.userId,
  });
  const now = new Date();
  const itemId = args.itemId;

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
}

export async function runUpdateRestaurantOrderMeta(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantOrderMetaInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const order = await getOpenOrderById(db, organizationId, args.orderId);

  const updates: Partial<typeof restaurantOrder.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (args.guestCount !== undefined) {
    updates.guestCount = toNonNegativeInteger(args.guestCount, "guestCount");
  }
  if (args.notes !== undefined) {
    updates.notes = normalizeOptionalString(args.notes);
  }

  await db
    .update(restaurantOrder)
    .set(updates)
    .where(eq(restaurantOrder.id, order.id));

  return { success: true };
}

export async function runUpdateRestaurantDraftItem(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantDraftItemInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const quantity = toPositiveInteger(args.quantity, "quantity");
  const notes =
    args.notes === undefined ? undefined : normalizeOptionalString(args.notes);

  const [itemRow] = await db
    .select({
      id: restaurantOrderItem.id,
      status: restaurantOrderItem.status,
      orderId: restaurantOrderItem.orderId,
    })
    .from(restaurantOrderItem)
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.id, args.orderItemId)
      )
    )
    .limit(1);

  if (!itemRow) {
    throw new Error("El ítem no existe en la organización activa.");
  }
  if (itemRow.status !== "draft") {
    throw new Error("Solo puedes editar ítems que aún no fueron enviados.");
  }

  await db
    .update(restaurantOrderItem)
    .set({
      quantity,
      ...(notes === undefined ? {} : { notes }),
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrderItem.id, itemRow.id));

  return { success: true, orderId: itemRow.orderId };
}

export async function runDeleteRestaurantDraftItem(
  db: RestaurantDbExecutor,
  args: z.infer<typeof DeleteRestaurantDraftItemInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const [itemRow] = await db
    .select({
      id: restaurantOrderItem.id,
      orderId: restaurantOrderItem.orderId,
      status: restaurantOrderItem.status,
    })
    .from(restaurantOrderItem)
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.id, args.orderItemId)
      )
    )
    .limit(1);

  if (!itemRow) {
    throw new Error("El ítem no existe en la organización activa.");
  }
  if (itemRow.status !== "draft") {
    throw new Error("Solo puedes eliminar ítems que aún no fueron enviados.");
  }

  const database = db;
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
}

export async function runSendRestaurantOrderToKitchen(
  db: RestaurantDbExecutor,
  args: z.infer<typeof SendRestaurantOrderToKitchenInputSchema> & {
    ticketId: string;
  },
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const [orgRow] = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const settings = getRestaurantModuleSettings(
    parseOrganizationSettingsMetadata(orgRow?.metadata)
  );

  const database = db;
  const order = await getOpenOrderById(database, organizationId, args.orderId);
  const [table, items] = await Promise.all([
    assertTableFromOrganization(database, organizationId, order.tableId),
    getOrderItemsWithModifiers(database, organizationId, order.id),
  ]);
  const draftItems = items.filter((item) => item.status === "draft");
  if (draftItems.length === 0) {
    throw new Error("No hay ítems pendientes por enviar a cocina.");
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
  const ticketId = args.ticketId;
  const sequenceNumber = (lastTicket?.sequenceNumber ?? 0) + 1;

  await database.insert(restaurantKitchenTicket).values({
    id: ticketId,
    organizationId,
    orderId: order.id,
    createdByUserId: auth.userId,
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
}

export async function runUpdateRestaurantOrderItemStatus(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantOrderItemStatusInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const [itemRow] = await db
    .select({
      id: restaurantOrderItem.id,
      status: restaurantOrderItem.status,
      kitchenTicketId: restaurantOrderItem.kitchenTicketId,
    })
    .from(restaurantOrderItem)
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.id, args.orderItemId)
      )
    )
    .limit(1);

  if (!itemRow) {
    throw new Error("El ítem no existe en la organización activa.");
  }
  if (itemRow.status === "draft" || itemRow.status === "cancelled") {
    throw new Error("El ítem aún no puede cambiar a ese estado.");
  }

  const now = new Date();
  await db
    .update(restaurantOrderItem)
    .set({
      status: args.status,
      readyAt: args.status === "ready" ? now : undefined,
      servedAt: args.status === "served" ? now : undefined,
      updatedAt: now,
    })
    .where(eq(restaurantOrderItem.id, itemRow.id));

  if (itemRow.kitchenTicketId) {
    await refreshKitchenTicketStatus(
      db,
      organizationId,
      itemRow.kitchenTicketId
    );
  }

  return { success: true };
}

export async function runCloseRestaurantOrder(
  db: RestaurantDbExecutor,
  args: z.infer<typeof CloseRestaurantOrderInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const order = await getOpenOrderById(db, organizationId, args.orderId);
  const items = await getOrderItemsWithModifiers(db, organizationId, order.id);
  const activeItems = items.filter((item) => item.status !== "cancelled");

  if (activeItems.length === 0) {
    throw new Error("No puedes cerrar una mesa sin ítems activos.");
  }

  const saleResult = await createCoreSale(
    {
      shiftId: normalizeRequiredString(args.shiftId, "shiftId"),
      customerId: normalizeOptionalString(args.customerId),
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
      payments: args.payments,
    },
    {
      db: db as Parameters<typeof createCoreSale>[1]["db"],
      organizationId,
      userId: auth.userId,
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
    db
      .update(restaurantOrder)
      .set({
        status: "closed",
        closedByUserId: auth.userId,
        closedAt: now,
        saleId: saleResult.saleId,
        updatedAt: now,
      })
      .where(eq(restaurantOrder.id, order.id)),
    db
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
          db
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

export async function runCreateRestaurantArea(
  db: RestaurantDbExecutor,
  args: z.infer<typeof CreateRestaurantAreaInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  const name = normalizeRequiredString(args.name, "name");
  const now = new Date();

  await db.insert(restaurantArea).values({
    id: crypto.randomUUID(),
    organizationId: auth.organizationId,
    name,
    sortOrder: await getNextAreaSortOrder(db, auth.organizationId),
    createdAt: now,
    updatedAt: now,
  });
}

export async function runUpdateRestaurantArea(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantAreaInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  const updates: Partial<typeof restaurantArea.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (args.name !== undefined) {
    updates.name = normalizeRequiredString(args.name, "name");
  }

  await assertAreaFromOrganization(db, auth.organizationId, args.id);
  await db
    .update(restaurantArea)
    .set(updates)
    .where(eq(restaurantArea.id, args.id));
}

export async function runDeleteRestaurantArea(
  db: RestaurantDbExecutor,
  args: z.infer<typeof DeleteRestaurantAreaInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  const [tableRow] = await db
    .select({ id: restaurantTable.id })
    .from(restaurantTable)
    .where(
      and(
        eq(restaurantTable.organizationId, auth.organizationId),
        eq(restaurantTable.areaId, args.id)
      )
    )
    .limit(1);

  if (tableRow) {
    throw new Error("No puedes eliminar una zona que aún tiene mesas.");
  }

  await db
    .delete(restaurantArea)
    .where(
      and(
        eq(restaurantArea.organizationId, auth.organizationId),
        eq(restaurantArea.id, args.id)
      )
    );
}

export async function runCreateRestaurantTable(
  db: RestaurantDbExecutor,
  args: z.infer<typeof CreateRestaurantTableInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  const area = await assertAreaFromOrganization(
    db,
    auth.organizationId,
    args.areaId
  );
  const name = normalizeRequiredString(args.name, "name");
  const seats = toNonNegativeInteger(args.seats ?? 0, "seats");
  const now = new Date();

  await db.insert(restaurantTable).values({
    id: crypto.randomUUID(),
    organizationId: auth.organizationId,
    areaId: area.id,
    name,
    seats,
    sortOrder: await getNextTableSortOrder(db, auth.organizationId, area.id),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function runUpdateRestaurantTable(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantTableInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  await assertTableFromOrganization(db, auth.organizationId, args.id);
  const updates: Partial<typeof restaurantTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (args.areaId !== undefined) {
    const area = await assertAreaFromOrganization(
      db,
      auth.organizationId,
      args.areaId
    );
    updates.areaId = area.id;
  }
  if (args.name !== undefined) {
    updates.name = normalizeRequiredString(args.name, "name");
  }
  if (args.seats !== undefined) {
    updates.seats = toNonNegativeInteger(args.seats, "seats");
  }
  if (args.isActive !== undefined) {
    updates.isActive = args.isActive;
  }

  await db
    .update(restaurantTable)
    .set(updates)
    .where(eq(restaurantTable.id, args.id));
}

export async function runDeleteRestaurantTable(
  db: RestaurantDbExecutor,
  args: z.infer<typeof DeleteRestaurantTableInputSchema>,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  const [orderRow] = await db
    .select({ id: restaurantOrder.id })
    .from(restaurantOrder)
    .where(
      and(
        eq(restaurantOrder.organizationId, auth.organizationId),
        eq(restaurantOrder.tableId, args.id)
      )
    )
    .limit(1);

  if (orderRow) {
    throw new Error("No puedes eliminar una mesa que ya tiene historial.");
  }

  await db
    .delete(restaurantTable)
    .where(
      and(
        eq(restaurantTable.organizationId, auth.organizationId),
        eq(restaurantTable.id, args.id)
      )
    );
}
