import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import {
  restaurantOrder,
  restaurantTable,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertAreaFromOrganization,
  assertManagerAccess,
  assertTableFromOrganization,
  getNextTableSortOrder,
  normalizeRequiredString,
  type RestaurantAuth,
  type RestaurantDbExecutor,
  toNonNegativeInteger,
} from "@/features/restaurants/restaurant-operations.server";
import type {
  CreateRestaurantTableInputSchema,
  DeleteRestaurantTableInputSchema,
  UpdateRestaurantTableInputSchema,
} from "@/features/restaurants/restaurants.schema";

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
        eq(restaurantOrder.tableId, args.id),
        eq(restaurantOrder.status, "open")
      )
    )
    .limit(1);

  if (orderRow) {
    throw new Error("No puedes eliminar una mesa que tiene una orden abierta.");
  }

  await db
    .update(restaurantTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(restaurantTable.organizationId, auth.organizationId),
        eq(restaurantTable.id, args.id),
        isNull(restaurantTable.deletedAt)
      )
    );
}
