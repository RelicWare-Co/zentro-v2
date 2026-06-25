import { describe, expect, test } from "bun:test";
import { runBuildDashboardOverview } from "@/features/dashboard/build-overview.server";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("dashboard overview accounting", () => {
  test("cash payment mix excludes returned change from overpaid sales", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Widget",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedShift(db, {
        organizationId,
        userId,
        startingCash: 5000,
        status: "open",
      }),
    ]);

    await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 12_000 }],
      },
      { db, organizationId, userId }
    );

    const overview = await runBuildDashboardOverview(
      db,
      { organizationId, userId },
      "America/Bogota"
    );

    expect(overview.stats.shiftRevenue).toBe(10_000);
    expect(overview.paymentMix).toEqual([{ method: "cash", amount: 10_000 }]);

    await cleanup();
  });

  test("credit sales separate gross sales from collected payments", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Account Item",
        price: 30_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, {
        organizationId,
        name: "Credit Customer",
      }),
      seedShift(db, {
        organizationId,
        userId,
        startingCash: 0,
        status: "open",
      }),
    ]);

    await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 30_000 }],
        payments: [{ method: "cash", amount: 5000 }],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    const overview = await runBuildDashboardOverview(
      db,
      { organizationId, userId },
      "America/Bogota"
    );

    expect(overview.stats.shiftRevenue).toBe(30_000);
    expect(overview.paymentMix).toEqual([{ method: "cash", amount: 5000 }]);
    expect(overview.stats.pendingCreditBalance).toBe(25_000);

    await cleanup();
  });
});
