import { describe, expect, test } from "bun:test";
import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";
import { createCoreSale } from "@/features/sales/create-sale.server";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { cancelSaleViaZero } from "./helpers/zero-sales";
import { createZeroTestDb } from "./helpers/zero-shifts";

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

describe("Zero inventory movements list", () => {
  test("paginates and filters by product and date", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const productA = await seedProduct(db, {
      organizationId,
      name: "Product A",
      stock: 10,
      trackInventory: true,
    });
    const productB = await seedProduct(db, {
      organizationId,
      name: "Product B",
      stock: 20,
      trackInventory: true,
    });
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const now = Date.now();

    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId: productA,
          type: "restock",
          quantity: 5,
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
        },
        ctx,
        tx,
      })
    );
    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId: productB,
          type: "waste",
          quantity: 2,
          createdAt: now - 1 * 24 * 60 * 60 * 1000,
        },
        ctx,
        tx,
      })
    );

    const filteredRows = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: productA,
          type: null,
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]).toMatchObject({
      productId: productA,
      type: "restock",
    });

    const pagedRows = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 1,
          productId: null,
          type: null,
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(pagedRows.length).toBeGreaterThanOrEqual(2);

    await cleanup();
  });

  test("denies list without organization context", async () => {
    const { db, cleanup } = await createTestDb();
    const zeroDb = createZeroTestDb(db);

    const rows = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: null,
          type: null,
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx: undefined,
      })
    );
    expect(rows).toHaveLength(0);

    await cleanup();
  });

  test("filters by movement type", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const productId = await seedProduct(db, {
      organizationId,
      name: "Type Filter Product",
      stock: 50,
      trackInventory: true,
    });
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const now = Date.now();

    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId,
          type: "restock",
          quantity: 10,
          createdAt: now - 3 * 24 * 60 * 60 * 1000,
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
          quantity: 2,
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
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
          type: "adjustment",
          quantity: 5,
          createdAt: now - 1 * 24 * 60 * 60 * 1000,
        },
        ctx,
        tx,
      })
    );

    const restockOnly = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: null,
          type: "restock",
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(restockOnly).toHaveLength(1);
    expect(restockOnly[0]?.type).toBe("restock");

    const wasteOnly = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: null,
          type: "waste",
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(wasteOnly).toHaveLength(1);
    expect(wasteOnly[0]?.type).toBe("waste");

    await cleanup();
  });

  test("filters by date range", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const productId = await seedProduct(db, {
      organizationId,
      name: "Date Range Product",
      stock: 50,
      trackInventory: true,
    });
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const now = Date.now();
    const day2 = now - 2 * 24 * 60 * 60 * 1000;
    const day4 = now - 4 * 24 * 60 * 60 * 1000;
    const day6 = now - 6 * 24 * 60 * 60 * 1000;

    await zeroDb.transaction((tx) =>
      serverMutators.products.registerInventoryMovement.fn({
        args: {
          id: crypto.randomUUID(),
          productId,
          type: "restock",
          quantity: 10,
          createdAt: day6,
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
          type: "restock",
          quantity: 5,
          createdAt: day4,
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
          type: "restock",
          quantity: 3,
          createdAt: day2,
        },
        ctx,
        tx,
      })
    );

    const inRange = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: null,
          type: null,
          searchQuery: null,
          startDate: new Date(day5(now)).toISOString(),
          endDate: new Date(day3(now)).toISOString(),
        },
        ctx,
      })
    );
    expect(inRange).toHaveLength(1);

    await cleanup();
  });

  test("sale-created movements appear with type 'sale'", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Sale Movement Product",
        price: 5000,
        stock: 20,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 3, unitPrice: 5000 }],
        payments: [{ method: "cash", amount: 15_000 }],
      },
      { db, organizationId, userId }
    );

    const saleMovements = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId: null,
          type: "sale",
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(saleMovements).toHaveLength(1);
    expect(saleMovements[0]?.type).toBe("sale");
    expect(saleMovements[0]?.quantity).toBe(-3);
    expect(saleMovements[0]?.productId).toBe(productId);

    await cleanup();
  });

  test("cancellation creates adjustment movement restoring stock", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Cancel Movement Product",
        price: 8000,
        stock: 15,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const custId = await seedCustomer(db, {
      organizationId,
      name: "Cancel Movement Customer",
    });

    const saleResult = await createCoreSale(
      {
        shiftId,
        customerId: custId,
        items: [{ productId, quantity: 4, unitPrice: 8000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    await cancelSaleViaZero({
      zeroDb,
      ctx,
      input: { saleId: saleResult.saleId },
    });

    const allMovements = await zeroDb.run(
      queries.products.movements.list.fn({
        args: {
          limit: 50,
          productId,
          type: null,
          searchQuery: null,
          startDate: null,
          endDate: null,
        },
        ctx,
      })
    );
    expect(allMovements).toHaveLength(2);
    expect(allMovements[0]?.type).toBe("adjustment");
    expect(allMovements[0]?.quantity).toBe(4);
    expect(allMovements[1]?.type).toBe("sale");
    expect(allMovements[1]?.quantity).toBe(-4);

    await cleanup();
  });
});

function day5(now: number) {
  return now - 5 * 24 * 60 * 60 * 1000;
}

function day3(now: number) {
  return now - 3 * 24 * 60 * 60 * 1000;
}
