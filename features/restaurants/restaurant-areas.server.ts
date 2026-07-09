import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import {
  restaurantArea,
  restaurantTable,
} from "@/database/drizzle/schema/restaurant.schema";
import {
  assertAreaFromOrganization,
  assertManagerAccess,
  getNextAreaSortOrder,
  normalizeRequiredString,
  type RestaurantAuth,
  type RestaurantDbExecutor,
} from "@/features/restaurants/restaurant-operations.server";
import type {
  CreateRestaurantAreaInputSchema,
  DeleteRestaurantAreaInputSchema,
  UpdateRestaurantAreaInputSchema,
} from "@/features/restaurants/restaurants.schema";

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
