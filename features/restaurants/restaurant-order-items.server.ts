import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  restaurantOrder,
  restaurantOrderItem,
  restaurantOrderItemModifier,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertTableFromOrganization,
  getOpenOrderById,
  getOpenOrderForTable,
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
  DiscardPendingKitchenChangesInputSchema,
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

const SentModifierSnapshotSchema = z.array(
  z.object({
    id: z.string().trim().min(1),
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().int().nonnegative(),
  })
);

interface CurrentOrderItemModifier {
  modifierProductId: string;
  quantity: number;
  unitPrice: number;
}

interface RestaurantOrderReference {
  id: string;
  status: string;
  tableId: string;
}

type SentModifierSnapshot = z.infer<typeof SentModifierSnapshotSchema>;

function parseSentModifierSnapshot(value: string): SentModifierSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("No se pudo restaurar el snapshot de modificadores.");
  }

  const result = SentModifierSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("No se pudo restaurar el snapshot de modificadores.");
  }
  return result.data;
}

function serializeCurrentModifiers(modifiers: CurrentOrderItemModifier[]) {
  return JSON.stringify(
    modifiers
      .map((modifier) => ({
        id: modifier.modifierProductId,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id))
  );
}

function serializeSentModifiers(modifiers: SentModifierSnapshot) {
  return JSON.stringify(
    modifiers
      .map((modifier) => ({
        id: modifier.id,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id))
  );
}

async function restoreSentOrderItem(
  db: RestaurantDbExecutor,
  item: {
    id: string;
    modifiers: CurrentOrderItemModifier[];
    notes: string | null;
    pendingCancellation: boolean;
    quantity: number;
    sentModifiersSnapshot: string;
    sentNotes: string | null;
    sentQuantity: number;
    status: string;
  },
  organizationId: string,
  now: Date
) {
  if (item.status !== "sent") {
    return false;
  }

  const sentQuantity =
    item.sentQuantity > 0 ? item.sentQuantity : item.quantity;
  const sentNotes = item.sentQuantity > 0 ? item.sentNotes : item.notes;
  const sentModifiers =
    item.sentQuantity > 0
      ? parseSentModifierSnapshot(item.sentModifiersSnapshot)
      : item.modifiers.map((modifier) => ({
          id: modifier.modifierProductId,
          name: "",
          quantity: modifier.quantity,
          unitPrice: modifier.unitPrice,
        }));
  const shouldRestoreModifiers =
    serializeCurrentModifiers(item.modifiers) !==
    serializeSentModifiers(sentModifiers);
  const needsRestore =
    item.pendingCancellation ||
    item.quantity !== sentQuantity ||
    item.notes !== sentNotes ||
    shouldRestoreModifiers;

  if (!needsRestore) {
    return false;
  }

  if (shouldRestoreModifiers) {
    await db
      .delete(restaurantOrderItemModifier)
      .where(eq(restaurantOrderItemModifier.orderItemId, item.id));

    if (sentModifiers.length > 0) {
      await db.insert(restaurantOrderItemModifier).values(
        sentModifiers.map((modifier) => ({
          id: crypto.randomUUID(),
          organizationId,
          orderItemId: item.id,
          modifierProductId: modifier.id,
          quantity: modifier.quantity,
          unitPrice: modifier.unitPrice,
          createdAt: now,
        }))
      );
    }
  }

  await db
    .update(restaurantOrderItem)
    .set({
      quantity: sentQuantity,
      notes: sentNotes,
      pendingCancellation: false,
      updatedAt: now,
    })
    .where(eq(restaurantOrderItem.id, item.id));
  return true;
}

async function resolveOpenOrderForDiscard(
  db: RestaurantDbExecutor,
  organizationId: string,
  tableId: string,
  requestedOrderId: string | null
) {
  let orderReference: RestaurantOrderReference | null = null;

  if (requestedOrderId) {
    const [orderById] = await db
      .select({
        id: restaurantOrder.id,
        status: restaurantOrder.status,
        tableId: restaurantOrder.tableId,
      })
      .from(restaurantOrder)
      .where(
        and(
          eq(restaurantOrder.organizationId, organizationId),
          eq(restaurantOrder.id, requestedOrderId)
        )
      )
      .limit(1);
    orderReference = orderById ?? null;
  }
  if (!orderReference) {
    orderReference = await getOpenOrderForTable(db, organizationId, tableId);
  }

  if (!orderReference) {
    return null;
  }
  if (orderReference.tableId !== tableId) {
    throw new Error("La cuenta no pertenece a la mesa activa.");
  }
  if (orderReference.status !== "open") {
    throw new Error("La cuenta no existe o ya no está abierta.");
  }

  return lockOpenRestaurantOrder(db, organizationId, orderReference.id);
}

async function getModifiersByOrderItemId(
  db: RestaurantDbExecutor,
  organizationId: string,
  itemIds: string[]
) {
  if (itemIds.length === 0) {
    return new Map<string, CurrentOrderItemModifier[]>();
  }

  const modifierRows = await db
    .select({
      orderItemId: restaurantOrderItemModifier.orderItemId,
      modifierProductId: restaurantOrderItemModifier.modifierProductId,
      quantity: restaurantOrderItemModifier.quantity,
      unitPrice: restaurantOrderItemModifier.unitPrice,
    })
    .from(restaurantOrderItemModifier)
    .where(
      and(
        eq(restaurantOrderItemModifier.organizationId, organizationId),
        inArray(restaurantOrderItemModifier.orderItemId, itemIds)
      )
    );
  const modifiersByItemId = new Map<string, CurrentOrderItemModifier[]>();

  for (const modifier of modifierRows) {
    const modifiers = modifiersByItemId.get(modifier.orderItemId) ?? [];
    modifiers.push({
      modifierProductId: modifier.modifierProductId,
      quantity: modifier.quantity,
      unitPrice: modifier.unitPrice,
    });
    modifiersByItemId.set(modifier.orderItemId, modifiers);
  }

  return modifiersByItemId;
}

async function deleteOrderIfEmpty(db: RestaurantDbExecutor, orderId: string) {
  const [remainingItem] = await db
    .select({ id: restaurantOrderItem.id })
    .from(restaurantOrderItem)
    .where(eq(restaurantOrderItem.orderId, orderId))
    .limit(1);

  if (!remainingItem) {
    await db.delete(restaurantOrder).where(eq(restaurantOrder.id, orderId));
  }
}

async function updateOrderTimestampIfPresent(
  db: RestaurantDbExecutor,
  orderId: string,
  now: Date
) {
  const [remainingOrder] = await db
    .select({ id: restaurantOrder.id })
    .from(restaurantOrder)
    .where(eq(restaurantOrder.id, orderId))
    .limit(1);

  if (remainingOrder) {
    await db
      .update(restaurantOrder)
      .set({ updatedAt: now })
      .where(eq(restaurantOrder.id, orderId));
  }
}

export async function runDiscardPendingKitchenChanges(
  db: RestaurantDbExecutor,
  args: z.infer<typeof DiscardPendingKitchenChangesInputSchema>,
  auth: RestaurantAuth
) {
  await requireRestaurantModuleAccess({
    db,
    organizationId: auth.organizationId,
  });
  const organizationId = auth.organizationId;
  const tableId = normalizeRequiredString(args.tableId, "tableId");
  const requestedOrderId = normalizeOptionalString(args.orderId);
  const order = await resolveOpenOrderForDiscard(
    db,
    organizationId,
    tableId,
    requestedOrderId
  );

  if (!order) {
    return {
      deletedDraftItems: 0,
      orderId: requestedOrderId,
      restoredItems: 0,
    };
  }
  const items = await db
    .select({
      id: restaurantOrderItem.id,
      status: restaurantOrderItem.status,
      quantity: restaurantOrderItem.quantity,
      notes: restaurantOrderItem.notes,
      pendingCancellation: restaurantOrderItem.pendingCancellation,
      sentModifiersSnapshot: restaurantOrderItem.sentModifiersSnapshot,
      sentQuantity: restaurantOrderItem.sentQuantity,
      sentNotes: restaurantOrderItem.sentNotes,
    })
    .from(restaurantOrderItem)
    .where(
      and(
        eq(restaurantOrderItem.organizationId, organizationId),
        eq(restaurantOrderItem.orderId, order.id)
      )
    );
  const modifiersByItemId = await getModifiersByOrderItemId(
    db,
    organizationId,
    items.map((item) => item.id)
  );

  const now = new Date();
  let deletedDraftItems = 0;
  let restoredItems = 0;

  for (const item of items) {
    if (item.status === "draft") {
      await db
        .delete(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, item.id));
      deletedDraftItems += 1;
      continue;
    }

    if (
      await restoreSentOrderItem(
        db,
        {
          ...item,
          modifiers: modifiersByItemId.get(item.id) ?? [],
        },
        organizationId,
        now
      )
    ) {
      restoredItems += 1;
    }
  }

  const changed = deletedDraftItems > 0 || restoredItems > 0;
  if (deletedDraftItems > 0) {
    await deleteOrderIfEmpty(db, order.id);
  }

  if (changed) {
    await updateOrderTimestampIfPresent(db, order.id, now);
  }

  return {
    deletedDraftItems,
    orderId: order.id,
    restoredItems,
  };
}
