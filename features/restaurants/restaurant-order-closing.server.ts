import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  getOrderItemsWithModifiers,
  lockOpenRestaurantOrder,
  normalizeOptionalString,
  normalizeRequiredString,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  requireRestaurantModuleAccess,
  toNonNegativeInteger,
} from "@/features/restaurants/restaurant-operations.server";
import type { CloseRestaurantOrderInputSchema } from "@/features/restaurants/restaurants.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";

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
  const order = await lockOpenRestaurantOrder(db, organizationId, args.orderId);
  const items = await getOrderItemsWithModifiers(db, organizationId, order.id);
  const hasKitchenHistory = items.some(
    (item) => item.sentQuantity > 0 || item.kitchenTicketId !== null
  );
  const hasPendingKitchenChanges =
    hasKitchenHistory &&
    items.some((item) => {
      if (item.status === "draft" || item.pendingCancellation) {
        return true;
      }
      if (item.status !== "sent") {
        return false;
      }
      const sentQuantity =
        item.sentQuantity > 0 ? item.sentQuantity : item.quantity;
      const sentNotes = item.sentQuantity > 0 ? item.sentNotes : item.notes;
      return item.quantity !== sentQuantity || item.notes !== sentNotes;
    });
  if (hasPendingKitchenChanges) {
    throw new Error(
      "Envía o resuelve las correcciones pendientes antes de cerrar la orden."
    );
  }
  const activeItems = items.filter((item) => item.status !== "cancelled");

  if (activeItems.length === 0) {
    throw new Error("No puedes cerrar una mesa sin ítems activos.");
  }

  const saleResult = await createCoreSale(
    {
      saleId: normalizeOptionalString(args.saleId) ?? undefined,
      shiftId: normalizeRequiredString(args.shiftId, "shiftId"),
      customerId: normalizeOptionalString(args.customerId),
      discountAmount: toNonNegativeInteger(
        args.discountAmount ?? 0,
        "discountAmount"
      ),
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
