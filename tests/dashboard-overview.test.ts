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
    expect(overview.stats.shiftGrossSales).toBe(10_000);
    expect(overview.stats.shiftNetRevenue).toBe(10_000);
    expect(overview.stats.shiftTaxCollected).toBe(0);
    expect(overview.stats.shiftCollectedTotal).toBe(10_000);
    expect(overview.paymentMix).toEqual([{ method: "cash", amount: 10_000 }]);
    expect(overview.collectedPaymentMix).toEqual([
      { method: "cash", amount: 10_000 },
    ]);

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
    expect(overview.stats.shiftGrossSales).toBe(30_000);
    expect(overview.stats.shiftNetRevenue).toBe(30_000);
    expect(overview.stats.shiftTaxCollected).toBe(0);
    expect(overview.stats.shiftCollectedTotal).toBe(5000);
    expect(overview.paymentMix).toEqual([{ method: "cash", amount: 5000 }]);
    expect(overview.stats.pendingCreditBalance).toBe(25_000);

    await cleanup();
  });

  test("dashboard separates gross sales, net revenue, tax, and collected totals", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Taxed Widget",
        price: 10_000,
        stock: 10,
        taxRate: 19,
        trackInventory: true,
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
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 11_900 }],
      },
      { db, organizationId, userId }
    );

    const overview = await runBuildDashboardOverview(
      db,
      { organizationId, userId },
      "America/Bogota"
    );

    expect(overview.stats.shiftGrossSales).toBe(11_900);
    expect(overview.stats.shiftNetRevenue).toBe(10_000);
    expect(overview.stats.shiftRevenue).toBe(10_000);
    expect(overview.stats.shiftTaxCollected).toBe(1900);
    expect(overview.stats.shiftCollectedTotal).toBe(11_900);
    expect(overview.stats.monthGrossSales).toBe(11_900);
    expect(overview.stats.monthNetRevenue).toBe(10_000);
    expect(overview.stats.monthRevenue).toBe(10_000);
    expect(overview.stats.monthTaxCollected).toBe(1900);
    expect(overview.stats.monthCollectedTotal).toBe(11_900);
    expect(overview.paymentMix).toEqual([{ method: "cash", amount: 11_900 }]);
    expect(overview.salesTrend.at(-1)).toMatchObject({
      grossSales: 11_900,
      netRevenue: 10_000,
      revenue: 10_000,
      taxCollected: 1900,
      salesCount: 1,
    });

    await cleanup();
  });
});
