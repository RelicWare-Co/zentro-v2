import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertTableFromOrganization,
  getOpenOrderById,
  getOrderItemsWithModifiers,
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
