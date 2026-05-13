import { describe, expect, test } from "bun:test";
import { createServerORPCClient } from "../server/orpc/client/server";
import { buildMockContext } from "./helpers/orpc-context";
import {
  seedCategory,
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("test infrastructure smoke", () => {
  test("createTestDb returns migrated DB that can query", async () => {
    const { db, cleanup } = createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    expect(organizationId).toBeString();
    expect(userId).toBeString();
    await cleanup();
  });

  test("seed helpers insert rows", async () => {
    const { db, cleanup } = createTestDb();
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

  test("buildMockContext + createServerORPCClient can call a public procedure", async () => {
    const { db, cleanup } = createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db, {
      userName: "Test User",
      userEmail: "test-user@example.com",
    });

    const user = {
      id: userId,
      name: "Test User",
      email: "test-user@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
    };

    const ctx = buildMockContext(db, user as any, organizationId);
    const client = createServerORPCClient(ctx);

    // joinLinkPreview is a public procedure that does not require auth/org
    const result = await client.organization.joinLinkPreview({
      token: "nonexistent-token",
    });
    expect(result.status).toBe("not-found");

    await cleanup();
  });
});
