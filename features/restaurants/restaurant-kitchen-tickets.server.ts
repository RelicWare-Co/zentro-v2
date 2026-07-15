import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  restaurantKitchenTicket,
  restaurantKitchenTicketLine,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertTableFromOrganization,
  getOrderItemsWithModifiers,
  lockOpenRestaurantOrder,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  refreshKitchenTicketStatus,
  requireRestaurantModuleAccess,
} from "@/features/restaurants/restaurant-operations.server";
import type {
  SendRestaurantOrderToKitchenInputSchema,
  UpdateRestaurantOrderItemStatusInputSchema,
} from "@/features/restaurants/restaurants.schema";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";

interface KitchenModifierSnapshot {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface KitchenItemSnapshot {
  modifiers: KitchenModifierSnapshot[];
  notes: string | null;
  productName: string;
  quantity: number;
}

interface KitchenTicketLineDraft extends KitchenItemSnapshot {
  operation: "cancel" | "modify" | "prepare";
  orderItemId: string;
  previousModifiers: KitchenModifierSnapshot[] | null;
  previousNotes: string | null;
  previousQuantity: number | null;
}

function normalizeModifiers(
  modifiers: Array<{
    modifierProductId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>
): KitchenModifierSnapshot[] {
  return modifiers
    .map((modifier) => ({
      id: modifier.modifierProductId,
      name: modifier.name,
      quantity: modifier.quantity,
      unitPrice: modifier.unitPrice,
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

function serializeModifiers(modifiers: KitchenModifierSnapshot[]) {
  return JSON.stringify(modifiers);
}

function parseModifiersSnapshot(value: string): KitchenModifierSnapshot[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((modifier): KitchenModifierSnapshot[] => {
      if (
        !modifier ||
        typeof modifier !== "object" ||
        !("id" in modifier) ||
        !("name" in modifier) ||
        !("quantity" in modifier) ||
        !("unitPrice" in modifier) ||
        typeof modifier.id !== "string" ||
        typeof modifier.name !== "string" ||
        typeof modifier.quantity !== "number" ||
        typeof modifier.unitPrice !== "number"
      ) {
        return [];
      }

      return [
        {
          id: modifier.id,
          name: modifier.name,
          quantity: modifier.quantity,
          unitPrice: modifier.unitPrice,
        },
      ];
    });
  } catch {
    return [];
  }
}

function makeSnapshot(item: {
  modifiers: Array<{
    modifierProductId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string | null;
  productName: string;
  quantity: number;
}): KitchenItemSnapshot {
  return {
    productName: item.productName,
    quantity: item.quantity,
    notes: item.notes,
    modifiers: normalizeModifiers(item.modifiers),
  };
}

function makeSentSnapshot(item: {
  modifiers: Array<{
    modifierProductId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string | null;
  productName: string;
  quantity: number;
  sentModifiersSnapshot: string;
  sentNotes: string | null;
  sentProductName: string | null;
  sentQuantity: number;
}): KitchenItemSnapshot {
  if (item.sentQuantity <= 0) {
    return makeSnapshot(item);
  }

  return {
    productName: item.sentProductName ?? item.productName,
    quantity: item.sentQuantity,
    notes: item.sentNotes,
    modifiers: parseModifiersSnapshot(item.sentModifiersSnapshot),
  };
}

function getCorrectionLines(item: {
  id: string;
  modifiers: Array<{
    modifierProductId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string | null;
  pendingCancellation: boolean;
  productName: string;
  quantity: number;
  sentModifiersSnapshot: string;
  sentNotes: string | null;
  sentProductName: string | null;
  sentQuantity: number;
  status: string;
}): KitchenTicketLineDraft[] {
  const current = makeSnapshot(item);
  if (item.status === "draft") {
    return [
      {
        ...current,
        operation: "prepare",
        orderItemId: item.id,
        previousModifiers: null,
        previousNotes: null,
        previousQuantity: null,
      },
    ];
  }

  const sent = makeSentSnapshot(item);
  if (item.pendingCancellation) {
    return sent.quantity > 0
      ? [
          {
            ...sent,
            operation: "cancel",
            orderItemId: item.id,
            previousModifiers: null,
            previousNotes: null,
            previousQuantity: null,
          },
        ]
      : [];
  }

  const currentModifiers = serializeModifiers(current.modifiers);
  const sentModifiers = serializeModifiers(sent.modifiers);
  const quantityDifference = current.quantity - sent.quantity;
  if (
    current.notes === sent.notes &&
    currentModifiers === sentModifiers &&
    quantityDifference === 0
  ) {
    return [];
  }

  return [
    {
      ...current,
      productName: sent.productName,
      operation: "modify",
      orderItemId: item.id,
      previousModifiers: sent.modifiers,
      previousNotes: sent.notes,
      previousQuantity: sent.quantity,
    },
  ];
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
  const order = await lockOpenRestaurantOrder(
    database,
    organizationId,
    args.orderId
  );
  const [table, items] = await Promise.all([
    assertTableFromOrganization(database, organizationId, order.tableId),
    getOrderItemsWithModifiers(database, organizationId, order.id),
  ]);
  const lines = items.flatMap((item) => getCorrectionLines(item));
  if (lines.length === 0) {
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
  const kind = lastTicket ? "correction" : "initial";

  await database.insert(restaurantKitchenTicket).values({
    id: ticketId,
    organizationId,
    orderId: order.id,
    createdByUserId: auth.userId,
    kind,
    sequenceNumber,
    status: "sent",
    createdAt: now,
    updatedAt: now,
    printedAt: null,
  });

  await database.insert(restaurantKitchenTicketLine).values(
    lines.map((line) => ({
      id: crypto.randomUUID(),
      organizationId,
      kitchenTicketId: ticketId,
      orderItemId: line.orderItemId,
      operation: line.operation,
      productName: line.productName,
      quantity: line.quantity,
      notes: line.notes,
      previousQuantity: line.previousQuantity,
      previousNotes: line.previousNotes,
      previousModifiersSnapshot:
        line.previousModifiers === null
          ? null
          : serializeModifiers(line.previousModifiers),
      modifiersSnapshot: serializeModifiers(line.modifiers),
      status: "sent",
      createdAt: now,
      updatedAt: now,
    }))
  );

  for (const item of items) {
    const itemLines = lines.filter((line) => line.orderItemId === item.id);
    if (itemLines.length === 0) {
      continue;
    }

    if (item.pendingCancellation) {
      await database
        .update(restaurantOrderItem)
        .set({
          kitchenTicketId: ticketId,
          status: "cancelled",
          pendingCancellation: false,
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(restaurantOrderItem.id, item.id));
      continue;
    }

    await database
      .update(restaurantOrderItem)
      .set({
        kitchenTicketId: ticketId,
        status: "sent",
        sentAt: now,
        sentQuantity: item.quantity,
        sentNotes: item.notes,
        sentProductName:
          item.status === "draft"
            ? item.productName
            : (item.sentProductName ?? item.productName),
        sentModifiersSnapshot: serializeModifiers(
          normalizeModifiers(item.modifiers)
        ),
        updatedAt: now,
      })
      .where(eq(restaurantOrderItem.id, item.id));
  }

  await database
    .update(restaurantOrder)
    .set({ updatedAt: now })
    .where(eq(restaurantOrder.id, order.id));

  return {
    ticket: {
      id: ticketId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      sequenceNumber,
      kind,
      createdAt: now.getTime(),
      table: {
        id: table.id,
        name: table.name,
        areaName: table.areaName,
      },
      lines,
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
  const [lineRow] = await db
    .select({
      id: restaurantKitchenTicketLine.id,
      operation: restaurantKitchenTicketLine.operation,
      orderItemId: restaurantKitchenTicketLine.orderItemId,
      kitchenTicketId: restaurantKitchenTicketLine.kitchenTicketId,
      lineStatus: restaurantKitchenTicketLine.status,
      orderStatus: restaurantOrder.status,
      ticketStatus: restaurantKitchenTicket.status,
    })
    .from(restaurantKitchenTicketLine)
    .innerJoin(
      restaurantKitchenTicket,
      eq(
        restaurantKitchenTicketLine.kitchenTicketId,
        restaurantKitchenTicket.id
      )
    )
    .innerJoin(
      restaurantOrder,
      eq(restaurantKitchenTicket.orderId, restaurantOrder.id)
    )
    .where(
      and(
        eq(restaurantKitchenTicketLine.organizationId, organizationId),
        eq(restaurantKitchenTicketLine.id, args.ticketLineId)
      )
    )
    .for("update")
    .limit(1);

  if (!lineRow) {
    throw new Error("La línea no existe en la organización activa.");
  }
  if (
    lineRow.orderStatus !== "open" ||
    !(lineRow.ticketStatus === "sent" || lineRow.ticketStatus === "ready")
  ) {
    throw new Error("La comanda ya no está activa en cocina.");
  }
  if (
    lineRow.lineStatus === "served" ||
    lineRow.lineStatus === "cancelled" ||
    lineRow.lineStatus === "acknowledged"
  ) {
    throw new Error("La línea ya está finalizada.");
  }
  if (lineRow.operation === "cancel" && args.status !== "cancelled") {
    throw new Error("Las anulaciones solo se pueden confirmar.");
  }
  if (lineRow.operation === "modify" && args.status !== "acknowledged") {
    throw new Error("Las modificaciones solo se pueden confirmar.");
  }
  if (
    lineRow.operation === "prepare" &&
    !(args.status === "ready" || args.status === "served")
  ) {
    throw new Error(
      "Los ítems de preparación solo se pueden marcar listos o despachar."
    );
  }

  const now = new Date();
  await db
    .update(restaurantKitchenTicketLine)
    .set({
      status: args.status,
      updatedAt: now,
    })
    .where(eq(restaurantKitchenTicketLine.id, lineRow.id));

  if (lineRow.operation === "prepare") {
    await db
      .update(restaurantOrderItem)
      .set({
        status: args.status,
        readyAt: args.status === "ready" ? now : undefined,
        servedAt: args.status === "served" ? now : undefined,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantOrderItem.id, lineRow.orderItemId),
          eq(restaurantOrderItem.kitchenTicketId, lineRow.kitchenTicketId)
        )
      );
  }

  if (lineRow.kitchenTicketId) {
    await refreshKitchenTicketStatus(
      db,
      organizationId,
      lineRow.kitchenTicketId
    );
  }

  return { success: true };
}
