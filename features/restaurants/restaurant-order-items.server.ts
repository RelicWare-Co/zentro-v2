import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import {
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertTableFromOrganization,
  getOpenOrderById,
  getOrCreateOpenOrderForTable,
  getProductSnapshot,
  lockOpenRestaurantOrder,
  normalizeOptionalString,
  normalizeRequiredString,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  requireRestaurantModuleAccess,
  toNonNegativeInteger,
  toPositiveInteger,
} from "@/features/restaurants/restaurant-operations.server";
import type {
  AddRestaurantOrderItemInputSchema,
  DeleteRestaurantOrderItemInputSchema,
  UpdateRestaurantOrderItemInputSchema,
  UpdateRestaurantOrderMetaInputSchema,
} from "@/features/restaurants/restaurants.schema";

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
  const modifierQuantities = new Map<string, number>();
  for (const modifierProductId of args.modifierProductIds ?? []) {
    const normalizedId = normalizeRequiredString(
      modifierProductId,
      "modifierProductIds[]"
    );
    modifierQuantities.set(
      normalizedId,
      Math.max(modifierQuantities.get(normalizedId) ?? 0, 1)
    );
  }
  for (const modifier of args.modifiers ?? []) {
    const normalizedId = normalizeRequiredString(
      modifier.modifierProductId,
      "modifiers[].modifierProductId"
    );
    const modifierQuantity = toPositiveInteger(
      modifier.quantity,
      "modifiers[].quantity"
    );
    modifierQuantities.set(
      normalizedId,
      (modifierQuantities.get(normalizedId) ?? 0) + modifierQuantity
    );
  }
  const modifierProductIds = [...modifierQuantities.keys()];

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
  if (
    baseProduct.accountingTreatment === "passthrough" &&
    modifierProductIds.length > 0
  ) {
    throw new Error("Un producto no contable no puede tener modificadores.");
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
        quantity: modifierQuantities.get(modifierProductId) ?? 1,
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

export async function runUpdateRestaurantOrderItem(
  db: RestaurantDbExecutor,
  args: z.infer<typeof UpdateRestaurantOrderItemInputSchema>,
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

  const [itemReference] = await db
    .select({
      id: restaurantOrderItem.id,
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

  if (!itemReference) {
    throw new Error("El ítem no existe en la organización activa.");
  }
  await lockOpenRestaurantOrder(db, organizationId, itemReference.orderId);

  const [itemRow] = await db
    .select({
      id: restaurantOrderItem.id,
      status: restaurantOrderItem.status,
      orderId: restaurantOrderItem.orderId,
      pendingCancellation: restaurantOrderItem.pendingCancellation,
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
  if (!(itemRow.status === "draft" || itemRow.status === "sent")) {
    throw new Error("Solo puedes editar ítems que siguen en preparación.");
  }
  if (itemRow.pendingCancellation) {
    throw new Error("El ítem está pendiente de anulación en cocina.");
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

export async function runDeleteRestaurantOrderItem(
  db: RestaurantDbExecutor,
  args: z.infer<typeof DeleteRestaurantOrderItemInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const [itemReference] = await db
    .select({
      id: restaurantOrderItem.id,
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

  if (!itemReference) {
    throw new Error("El ítem no existe en la organización activa.");
  }
  await lockOpenRestaurantOrder(db, organizationId, itemReference.orderId);

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
  if (itemRow.status === "sent") {
    await db
      .update(restaurantOrderItem)
      .set({
        pendingCancellation: true,
        updatedAt: new Date(),
      })
      .where(eq(restaurantOrderItem.id, itemRow.id));

    return { success: true, orderId: itemRow.orderId };
  }
  if (itemRow.status !== "draft") {
    throw new Error("Solo puedes eliminar ítems que siguen en preparación.");
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
