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

export const DEFAULT_RESTAURANT_AREA_NAMES = [
  "Domicilios",
  "Recogida",
] as const;

function isDefaultRestaurantAreaName(name: string) {
  return DEFAULT_RESTAURANT_AREA_NAMES.includes(
    name as (typeof DEFAULT_RESTAURANT_AREA_NAMES)[number]
  );
}

type RestaurantAreaSetupDbExecutor = Pick<
  RestaurantDbExecutor,
  "select" | "insert"
>;

export async function ensureDefaultRestaurantAreas(
  db: RestaurantAreaSetupDbExecutor,
  organizationId: string
) {
  const existingAreas = await db
    .select({ name: restaurantArea.name })
    .from(restaurantArea)
    .where(eq(restaurantArea.organizationId, organizationId));
  const existingNames = new Set(existingAreas.map((area) => area.name));
  const missingNames = DEFAULT_RESTAURANT_AREA_NAMES.filter(
    (name) => !existingNames.has(name)
  );

  if (missingNames.length === 0) {
    return;
  }

  const nextSortOrder = await getNextAreaSortOrder(db, organizationId);
  const now = new Date();
  await db.insert(restaurantArea).values(
    missingNames.map((name, index) => ({
      id: crypto.randomUUID(),
      organizationId,
      name,
      sortOrder: nextSortOrder + index,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export async function runEnsureDefaultRestaurantAreas(
  db: RestaurantDbExecutor,
  auth: RestaurantAuth
) {
  await assertManagerAccess({
    db,
    organizationId: auth.organizationId,
    user: { id: auth.userId },
  });
  await ensureDefaultRestaurantAreas(db, auth.organizationId);
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
  const area = await assertAreaFromOrganization(
    db,
    auth.organizationId,
    args.id
  );
  const updates: Partial<typeof restaurantArea.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (args.name !== undefined) {
    const name = normalizeRequiredString(args.name, "name");
    if (isDefaultRestaurantAreaName(area.name) && name !== area.name) {
      throw new Error("Las zonas de domicilios y recogida son obligatorias.");
    }
    updates.name = name;
  }

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

  const area = await assertAreaFromOrganization(
    db,
    auth.organizationId,
    args.id
  );
  if (isDefaultRestaurantAreaName(area.name)) {
    throw new Error("Las zonas de domicilios y recogida son obligatorias.");
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
