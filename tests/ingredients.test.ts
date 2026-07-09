import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  inventoryMovement,
  product,
  productIngredient,
} from "@/database/drizzle/schema/inventory.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedProductIngredient,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { cancelSaleViaZero } from "./helpers/zero-sales";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("ingredient products", () => {
  test("creating an ingredient product forces price 0 and isModifier false", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const productId = crypto.randomUUID();

    await zeroDb.transaction((tx) =>
      serverMutators.products.create.fn({
        args: {
          id: productId,
          name: "Coffee Beans",
          price: 0,
          isIngredient: true,
          stock: 100,
        },
        ctx,
        tx,
      })
    );

    const rows = await db
      .select()
      .from(product)
      .where(eq(product.id, productId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      isIngredient: true,
      price: 0,
      isModifier: false,
      accountingTreatment: "revenue",
    });

    await cleanup();
  });

  test("POS catalog excludes ingredient products", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const sellableId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
    });
    await seedProduct(db, {
      organizationId,
      name: "Coffee Beans Bulk",
      isIngredient: true,
    });

    const catalogRows = await zeroDb.run(
      queries.products.posCatalog.fn({
        args: { categoryId: null, limit: 100, searchQuery: null },
        ctx,
      })
    );
    const catalogIds = catalogRows.map((row) => row.id);
    expect(catalogIds).toContain(sellableId);
    expect(catalogRows).toHaveLength(1);

    await cleanup();
  });

  test("ingredients query returns only ingredient products", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const ingredientId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
    });
    await seedProduct(db, {
      organizationId,
      name: "Cappuccino",
      price: 9000,
    });

    const ingredientRows = await zeroDb.run(
      queries.products.ingredients.fn({ args: {}, ctx })
    );
    expect(ingredientRows).toHaveLength(1);
    expect(ingredientRows[0].id).toBe(ingredientId);

    await cleanup();
  });
});

describe("product ingredient recipes", () => {
  test("setForProduct replaces recipe ingredients", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const latteId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
    });
    const milkId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
      stock: 100,
    });
    const sugarId = await seedProduct(db, {
      organizationId,
      name: "Sugar",
      isIngredient: true,
      stock: 100,
    });

    await seedProductIngredient(db, {
      organizationId,
      productId: latteId,
      ingredientId: milkId,
      quantity: 2,
    });

    await zeroDb.transaction((tx) =>
      serverMutators.productIngredients.setForProduct.fn({
        args: {
          productId: latteId,
          ingredients: [
            { ingredientId: milkId, quantity: 3 },
            { ingredientId: sugarId, quantity: 1 },
          ],
        },
        ctx,
        tx,
      })
    );

    const recipeRows = await db
      .select()
      .from(productIngredient)
      .where(eq(productIngredient.productId, latteId));
    expect(recipeRows).toHaveLength(2);
    const milkRow = recipeRows.find((r) => r.ingredientId === milkId);
    const sugarRow = recipeRows.find((r) => r.ingredientId === sugarId);
    expect(milkRow?.quantity).toBe(3);
    expect(sugarRow?.quantity).toBe(1);

    await cleanup();
  });

  test("setForProduct with empty array clears all ingredients", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const latteId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
    });
    const milkId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
      stock: 100,
    });

    await seedProductIngredient(db, {
      organizationId,
      productId: latteId,
      ingredientId: milkId,
      quantity: 2,
    });

    await zeroDb.transaction((tx) =>
      serverMutators.productIngredients.setForProduct.fn({
        args: {
          productId: latteId,
          ingredients: [],
        },
        ctx,
        tx,
      })
    );

    const recipeRows = await db
      .select()
      .from(productIngredient)
      .where(eq(productIngredient.productId, latteId));
    expect(recipeRows).toHaveLength(0);

    await cleanup();
  });
});

describe("ingredient consumption on sale", () => {
  test("selling a product with recipe decrements ingredient stock", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);

    const latteId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
      stock: 50,
      trackInventory: true,
    });
    const milkId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
      stock: 100,
      trackInventory: true,
    });
    const shiftId = await seedShift(db, {
      organizationId,
      userId,
      status: "open",
    });

    await seedProductIngredient(db, {
      organizationId,
      productId: latteId,
      ingredientId: milkId,
      quantity: 2,
    });

    await createCoreSale(
      {
        shiftId,
        items: [
          {
            productId: latteId,
            quantity: 3,
            unitPrice: 8000,
          },
        ],
        payments: [{ method: "cash", amount: 24_000 }],
      },
      { db, organizationId, userId }
    );

    const latteRows = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, latteId));
    expect(latteRows[0].stock).toBe(47);

    const milkRows = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, milkId));
    expect(milkRows[0].stock).toBe(94);

    await cleanup();
  });

  test("cancelling a sale restores ingredient stock", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const latteId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
      stock: 50,
      trackInventory: true,
    });
    const milkId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
      stock: 100,
      trackInventory: true,
    });
    const shiftId = await seedShift(db, {
      organizationId,
      userId,
      status: "open",
    });

    await seedProductIngredient(db, {
      organizationId,
      productId: latteId,
      ingredientId: milkId,
      quantity: 2,
    });

    const sale = await createCoreSale(
      {
        shiftId,
        items: [
          {
            productId: latteId,
            quantity: 3,
            unitPrice: 8000,
          },
        ],
        payments: [{ method: "cash", amount: 24_000 }],
      },
      { db, organizationId, userId }
    );

    const milkAfterSale = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, milkId));
    expect(milkAfterSale[0].stock).toBe(94);

    await cancelSaleViaZero({
      zeroDb,
      ctx,
      input: { saleId: sale.saleId },
    });

    const milkAfterCancel = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, milkId));
    expect(milkAfterCancel[0].stock).toBe(100);

    const latteAfterCancel = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, latteId));
    expect(latteAfterCancel[0].stock).toBe(50);

    await cleanup();
  });

  test("ingredient consumption creates adjustment movements", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);

    const latteId = await seedProduct(db, {
      organizationId,
      name: "Latte",
      price: 8000,
      stock: 50,
      trackInventory: true,
    });
    const milkId = await seedProduct(db, {
      organizationId,
      name: "Milk",
      isIngredient: true,
      stock: 100,
      trackInventory: true,
    });
    const shiftId = await seedShift(db, {
      organizationId,
      userId,
      status: "open",
    });

    await seedProductIngredient(db, {
      organizationId,
      productId: latteId,
      ingredientId: milkId,
      quantity: 2,
    });

    await createCoreSale(
      {
        shiftId,
        items: [
          {
            productId: latteId,
            quantity: 3,
            unitPrice: 8000,
          },
        ],
        payments: [{ method: "cash", amount: 24_000 }],
      },
      { db, organizationId, userId }
    );

    const milkMovements = await db
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, milkId));
    expect(milkMovements).toHaveLength(1);
    expect(milkMovements[0]).toMatchObject({
      type: "sale",
      quantity: -6,
    });

    await cleanup();
  });
});
