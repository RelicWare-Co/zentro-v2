import { describe, expect, test } from "bun:test";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { eq } from "drizzle-orm";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import { type ZeroContext, schema as zeroSchema } from "@/zero/schema";
import {
  seedCategory,
  seedOrganizationWithMember,
  seedProduct,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

function createZeroContext(userId: string, organizationId: string) {
  return {
    id: userId,
    orgID: organizationId,
    email: "test@example.com",
    role: "owner",
    systemRole: null,
    organizationPolicy: buildOrganizationAccessPolicy(),
  } satisfies ZeroContext;
}

describe("Zero products", () => {
  test("category creation normalizes name and description", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = createZeroContext(userId, organizationId);
    const categoryId = crypto.randomUUID();

    await zeroDb.transaction((tx) =>
      serverMutators.products.createCategory.fn({
        args: {
          id: categoryId,
          name: "  Beverages  ",
          description: "  ",
        },
        ctx,
        tx,
      })
    );

    const rows = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Beverages");
    expect(rows[0].description).toBeNull();

    await cleanup();
  });

  test("product CRUD and search run through Zero without oRPC", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = createZeroContext(userId, organizationId);
    const categoryId = await seedCategory(db, {
      organizationId,
      name: "Food",
    });
    const productId = crypto.randomUUID();

    await zeroDb.transaction((tx) =>
      serverMutators.products.create.fn({
        args: {
          id: productId,
          name: "  Burger  ",
          categoryId,
          sku: "BUR-001",
          barcode: "123456789",
          price: 15_000,
          cost: 5000,
          taxRate: 0,
          stock: 50,
          minStock: 8,
          reorderQuantity: 12,
          trackInventory: true,
          isModifier: false,
        },
        ctx,
        tx,
      })
    );

    const createdRows = await zeroDb.run(
      queries.products.search.fn({
        args: { categoryId: null, limit: 100, searchQuery: "burger" },
        ctx,
      })
    );
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0]).toMatchObject({
      id: productId,
      name: "Burger",
      organizationId,
      sku: "BUR-001",
      minStock: 8,
      reorderQuantity: 12,
    });

    const byIdRows = await zeroDb.run(
      queries.products.byId.fn({
        args: { productId },
        ctx,
      })
    );
    expect(byIdRows).toHaveLength(1);
    expect(byIdRows[0]).toMatchObject({
      id: productId,
      name: "Burger",
    });

    await zeroDb.transaction((tx) =>
      serverMutators.products.update.fn({
        args: {
          id: productId,
          name: "  Premium Burger  ",
          isModifier: true,
        },
        ctx,
        tx,
      })
    );

    const updatedRows = await db
      .select()
      .from(product)
      .where(eq(product.id, productId));
    expect(updatedRows[0]).toMatchObject({
      isModifier: true,
      name: "Premium Burger",
    });

    await zeroDb.transaction((tx) =>
      serverMutators.products.delete.fn({
        args: { id: productId },
        ctx,
        tx,
      })
    );

    const afterDeleteRows = await zeroDb.run(
      queries.products.search.fn({
        args: { categoryId: null, limit: 100, searchQuery: "burger" },
        ctx,
      })
    );
    expect(afterDeleteRows).toHaveLength(0);

    await cleanup();
  });

  test("product creation rejects external-org category", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const { organizationId: otherOrgId } = await seedOrganizationWithMember(
      db,
      {
        orgName: "Other Org",
      }
    );
    const externalCategoryId = await seedCategory(db, {
      organizationId: otherOrgId,
      name: "External Category",
    });
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = createZeroContext(userId, organizationId);

    await expect(
      zeroDb.transaction((tx) =>
        serverMutators.products.create.fn({
          args: {
            id: crypto.randomUUID(),
            name: "Invalid Product",
            categoryId: externalCategoryId,
            price: 10_000,
          },
          ctx,
          tx,
        })
      )
    ).rejects.toThrow(
      "La categoría seleccionada no existe en la organización actual"
    );

    await cleanup();
  });

  test("inventory movement registration updates stock correctly", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const productId = await seedProduct(db, {
      organizationId,
      name: "Coffee Beans",
      price: 20_000,
      stock: 100,
      trackInventory: true,
    });
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = createZeroContext(userId, organizationId);

    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId,
          type: "restock",
          quantity: 50,
          notes: "New shipment",
        },
        ctx,
        tx,
      })
    );
    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId,
          type: "waste",
          quantity: 20,
          notes: "Expired batch",
        },
        ctx,
        tx,
      })
    );

    const rows = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, productId));
    expect(rows[0].stock).toBe(130);

    await cleanup();
  });

  test("set_as_total restock sets stock to target quantity", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const productId = await seedProduct(db, {
      organizationId,
      name: "Shelf Staple",
      price: 5000,
      stock: 10,
      trackInventory: true,
    });
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = createZeroContext(userId, organizationId);

    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId,
          type: "restock",
          quantity: 25,
          restockMode: "set_as_total",
        },
        ctx,
        tx,
      })
    );

    const rows = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, productId));
    expect(rows[0].stock).toBe(25);

    await cleanup();
  });
});
