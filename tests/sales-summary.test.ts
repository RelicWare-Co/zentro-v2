import { describe, expect, test } from "bun:test";
import { buildSalesSummary } from "@/features/sales/build-sales-summary.server";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { listSalesViaZero } from "./helpers/zero-sales";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("sales summary", () => {
  test("is independent from the number of paginated sales loaded", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Summary item",
        price: 10_000,
        stock: 20,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);
    const anotherShiftId = await seedShift(db, {
      organizationId,
      userId,
      status: "open",
    });
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);

    try {
      for (const quantity of [1, 2, 3]) {
        await createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity, unitPrice: 10_000 }],
            payments: [{ method: "cash", amount: quantity * 10_000 }],
          },
          { db, organizationId, userId }
        );
      }

      await createCoreSale(
        {
          shiftId: anotherShiftId,
          items: [{ productId, quantity: 4, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 40_000 }],
        },
        { db, organizationId, userId }
      );

      const [firstPage, expandedPage, shiftSummary, allSalesSummary] =
        await Promise.all([
          listSalesViaZero({
            zeroDb,
            ctx: zeroCtx,
            input: { limit: 1, shiftIds: [shiftId] },
          }),
          listSalesViaZero({
            zeroDb,
            ctx: zeroCtx,
            input: { limit: 3, shiftIds: [shiftId] },
          }),
          buildSalesSummary(
            db,
            { organizationId, userId },
            { shiftIds: [shiftId] }
          ),
          buildSalesSummary(db, { organizationId, userId }, {}),
        ]);

      expect(firstPage.data).toHaveLength(1);
      expect(expandedPage.data).toHaveLength(3);
      expect(shiftSummary).toEqual({
        salesCount: 3,
        totalPending: 0,
        totalRevenue: 60_000,
      });
      expect(allSalesSummary).toEqual({
        salesCount: 4,
        totalPending: 0,
        totalRevenue: 100_000,
      });
    } finally {
      await cleanup();
    }
  });
});
