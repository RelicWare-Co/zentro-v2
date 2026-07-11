import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  getOpenOrderById,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  requireRestaurantModuleAccess,
} from "@/features/restaurants/restaurant-operations.server";
import type { CancelRestaurantOrderInputSchema } from "@/features/restaurants/restaurants.schema";

export async function runCancelRestaurantOrder(
  db: RestaurantDbExecutor,
  args: z.infer<typeof CancelRestaurantOrderInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });

  const organizationId = auth.organizationId;
  const order = await getOpenOrderById(db, organizationId, args.orderId);
  const now = new Date();

  await Promise.all([
    db
      .update(restaurantOrder)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledByUserId: auth.userId,
        cancellationReason: args.reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantOrder.organizationId, organizationId),
          eq(restaurantOrder.id, order.id),
          eq(restaurantOrder.status, "open")
        )
      ),
    db
      .update(restaurantOrderItem)
      .set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantOrderItem.organizationId, organizationId),
          eq(restaurantOrderItem.orderId, order.id),
          isNull(restaurantOrderItem.cancelledAt)
        )
      ),
    db
      .update(restaurantKitchenTicket)
      .set({
        status: "cancelled",
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantKitchenTicket.organizationId, organizationId),
          eq(restaurantKitchenTicket.orderId, order.id)
        )
      ),
  ]);
}
