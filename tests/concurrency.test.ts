import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { creditAccount } from "@/database/drizzle/schema/credit.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { registerCreditPaymentViaZero } from "./helpers/zero-credit";
import { cancelSaleViaZero } from "./helpers/zero-sales";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("concurrency", () => {
  test("simultaneous sales on same product maintain stock invariant", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Concurrent Item",
        price: 1000,
        stock: 10,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 4, unitPrice: 1000 }],
            payments: [{ method: "cash", amount: 4000 }],
          },
          { db, organizationId, userId }
        )
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length + rejected.length).toBe(3);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length).toBeLessThanOrEqual(2);

    const [productRow] = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, productId));
    expect(productRow?.stock).toBeGreaterThanOrEqual(0);
    expect(productRow?.stock).toBe(10 - fulfilled.length * 4);

    await cleanup();
  });

  test("double cancellation attempt — only one succeeds", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Concurrent Cancel",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Concurrent Cancel Customer" }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const saleResult = await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    const results = await Promise.allSettled([
      cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      }),
      cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const [saleRow] = await db
      .select({ status: sale.status })
      .from(sale)
      .where(eq(sale.id, saleResult.saleId));
    expect(saleRow?.status).toBe("cancelled");

    await cleanup();
  });

  test("simultaneous credit payments on same account do not make balance negative", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Concurrent Credit",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Concurrent Credit Customer" }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const saleResult = await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    const [accountRow] = await db
      .select()
      .from(creditAccount)
      .where(eq(creditAccount.customerId, customerId));

    const results = await Promise.allSettled([
      registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountRow?.id,
          saleId: saleResult.saleId,
          amount: 10_000,
          method: "cash",
        },
      }),
      registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountRow?.id,
          saleId: saleResult.saleId,
          amount: 10_000,
          method: "cash",
        },
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const [updatedAccount] = await db
      .select({ balance: creditAccount.balance })
      .from(creditAccount)
      .where(eq(creditAccount.id, accountRow?.id));
    expect(updatedAccount?.balance).toBeGreaterThanOrEqual(0);

    await cleanup();
  });
});
