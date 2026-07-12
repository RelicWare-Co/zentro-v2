import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
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
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";

export type RestaurantDbExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

export type RestaurantTransaction = Parameters<
  Parameters<RestaurantDbExecutor["transaction"]>[0]
>[0];
export type RestaurantDatabase = RestaurantDbExecutor | RestaurantTransaction;

export interface RestaurantAuth {
  organizationId: string;
  userId: string;
}

export function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }
  return normalized;
}

export function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

export function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
  }
  return normalized;
}

export function toTimestamp(value: Date | number | string | null | undefined) {
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

export async function assertManagerAccess(context: {
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

export async function requireRestaurantModuleAccess(context: {
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

export function calculateModifierTotal(
  baseQuantity: number,
  modifiers: Array<{ quantity: number; unitPrice: number }>
) {
  let total = 0;
  for (const modifier of modifiers) {
    total += baseQuantity * modifier.quantity * modifier.unitPrice;
  }
  return total;
}

export async function assertAreaFromOrganization(
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

export async function assertTableFromOrganization(
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

export async function getOpenOrderForTable(
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

export async function getOpenOrderById(
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

export async function getNextOrderNumber(
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

export async function getNextAreaSortOrder(
  database: Pick<RestaurantDbExecutor, "select">,
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

export async function getNextTableSortOrder(
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

export async function getOrCreateOpenOrderForTable(input: {
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

export async function getProductSnapshot(
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
        accountingTreatment: string;
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
      accountingTreatment: product.accountingTreatment,
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

export async function getOrderItemsWithModifiers(
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

export async function refreshKitchenTicketStatus(
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
