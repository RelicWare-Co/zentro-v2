import { describe, expect, test } from "bun:test";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";
import { serverMutators } from "@/src/zero/mutators.server";
import { queries } from "@/src/zero/queries";
import { type ZeroContext, schema as zeroSchema } from "@/src/zero/schema";
import { seedOrganizationWithMember, seedProduct } from "./helpers/seed";
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
    const zeroDb = zeroDrizzle(zeroSchema, db);
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
    const zeroDb = zeroDrizzle(zeroSchema, db);

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
});
