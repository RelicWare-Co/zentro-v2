import { describe, expect, test } from "bun:test";
import {
  seedCategory,
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { getJoinLinkPreviewViaZero } from "./helpers/zero-organization";
import { createZeroTestDb } from "./helpers/zero-shifts";

describe("test infrastructure smoke", () => {
  test("createTestDb returns migrated DB that can query", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    expect(organizationId).toBeString();
    expect(userId).toBeString();
    await cleanup();
  });

  test("seed helpers insert rows", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const categoryId = await seedCategory(db, {
      organizationId,
      name: "Drinks",
    });
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        categoryId,
        name: "Coffee",
        price: 5000,
      }),
      seedCustomer(db, {
        organizationId,
        name: "Alice",
      }),
      seedShift(db, {
        organizationId,
        userId,
        startingCash: 10_000,
      }),
    ]);
    expect(categoryId).toBeString();
    expect(productId).toBeString();
    expect(customerId).toBeString();
    expect(shiftId).toBeString();
    await cleanup();
  });

  test("getJoinLinkPreviewViaZero returns not-found for missing token", async () => {
    const { db, cleanup } = await createTestDb();
    await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);

    const result = await getJoinLinkPreviewViaZero({
      zeroDb,
      token: "nonexistent-token",
    });
    expect(result.status).toBe("not-found");

    await cleanup();
  });
});
