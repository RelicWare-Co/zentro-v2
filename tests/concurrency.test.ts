import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schemas as a namespace object
import * as schema from "@/database/drizzle/schema";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { creditAccount } from "@/database/drizzle/schema/credit.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import { lockOpenRestaurantOrder } from "@/features/restaurants/restaurant-operations.server";
import { runCancelRestaurantOrder } from "@/features/restaurants/restaurant-order-cancellation.server";
import { runAddRestaurantOrderItem } from "@/features/restaurants/restaurant-order-items.server";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  parseOrganizationSettingsMetadata,
  serializeOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedRestaurantArea,
  seedRestaurantTable,
  seedShift,
} from "./helpers/seed";
import type { TestDb } from "./helpers/test-db";
import { createTestDb } from "./helpers/test-db";
import { registerCreditPaymentViaZero } from "./helpers/zero-credit";
import {
  addRestaurantOrderItemViaZero,
  sendRestaurantOrderToKitchenViaZero,
  updateRestaurantOrderItemViaZero,
} from "./helpers/zero-restaurants";
import { cancelSaleViaZero } from "./helpers/zero-sales";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

async function enableRestaurantModule(db: TestDb, organizationId: string) {
  const settings = parseOrganizationSettingsMetadata(null);
  await db
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata({
        ...settings,
        modules: {
          ...settings.modules,
          restaurants: {
            ...settings.modules.restaurants,
            enabled: true,
          },
        },
      }),
    })
    .where(eq(organization.id, organizationId));
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

async function waitForPostgresLock(db: TestDb, processId: number) {
  for (const _attempt of Array.from({ length: 100 })) {
    const [activity] = await db.$client`
      SELECT wait_event_type
      FROM pg_stat_activity
      WHERE pid = ${processId}
    `;
    if (activity?.wait_event_type === "Lock") {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
  }

  throw new Error("La segunda transacción no quedó esperando el bloqueo.");
}

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

  test("simultaneous kitchen corrections keep a single stable sequence", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    const firstDb = drizzle(firstClient, { schema }) as TestDb;
    const secondDb = drizzle(secondClient, { schema }) as TestDb;

    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      await enableRestaurantModule(db, organizationId);
      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Corrección concurrente",
          price: 10_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const firstZeroDb = createZeroTestDb(firstDb);
      const secondZeroDb = createZeroTestDb(secondDb);
      const ctx = createZeroContext(userId, organizationId);
      const added = await addRestaurantOrderItemViaZero({
        db,
        zeroDb: firstZeroDb,
        ctx,
        input: { tableId, productId, quantity: 1 },
      });
      await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb: firstZeroDb,
        ctx,
        input: { orderId: added.orderId },
      });
      await updateRestaurantOrderItemViaZero({
        zeroDb: firstZeroDb,
        ctx,
        input: { orderItemId: added.itemId, quantity: 2 },
      });

      const concurrentResults = await Promise.allSettled([
        sendRestaurantOrderToKitchenViaZero({
          db: firstDb,
          zeroDb: firstZeroDb,
          ctx,
          input: { orderId: added.orderId },
        }),
        sendRestaurantOrderToKitchenViaZero({
          db: secondDb,
          zeroDb: secondZeroDb,
          ctx,
          input: { orderId: added.orderId },
        }),
      ]);
      expect(
        concurrentResults.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(
        concurrentResults.filter((result) => result.status === "rejected")
      ).toHaveLength(1);

      const ticketRows = await db
        .select({
          kind: restaurantKitchenTicket.kind,
          sequenceNumber: restaurantKitchenTicket.sequenceNumber,
        })
        .from(restaurantKitchenTicket)
        .where(eq(restaurantKitchenTicket.orderId, added.orderId));
      expect(
        ticketRows.map((ticket) => ticket.sequenceNumber).toSorted()
      ).toEqual([1, 2]);
      expect(
        ticketRows.find((ticket) => ticket.sequenceNumber === 2)?.kind
      ).toBe("correction");
    } finally {
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
  });

  test("adding while cancelling cannot leave a draft item on the cancelled order", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    const firstDb = drizzle(firstClient, { schema }) as TestDb;
    const secondDb = drizzle(secondClient, { schema }) as TestDb;

    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      await enableRestaurantModule(db, organizationId);
      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T2",
        }),
        seedProduct(db, {
          organizationId,
          name: "Adición concurrente",
          price: 10_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const firstZeroDb = createZeroTestDb(firstDb);
      const secondZeroDb = createZeroTestDb(secondDb);
      const ctx = createZeroContext(userId, organizationId);
      const initialItem = await addRestaurantOrderItemViaZero({
        db,
        zeroDb: firstZeroDb,
        ctx,
        input: { tableId, productId, quantity: 1 },
      });
      const [secondBackend] = await secondClient`
        SELECT pg_backend_pid() AS pid
      `;
      if (!secondBackend) {
        throw new Error("No se pudo identificar la segunda transacción.");
      }

      const lockHeld = createDeferred();
      const continueCancellation = createDeferred();
      const cancellation = firstDb.transaction(async (transaction) => {
        await lockOpenRestaurantOrder(
          transaction,
          organizationId,
          initialItem.orderId
        );
        lockHeld.resolve();
        await continueCancellation.promise;
        await runCancelRestaurantOrder(
          transaction,
          { orderId: initialItem.orderId, reason: "Cierre concurrente" },
          { organizationId, userId }
        );
      });
      await lockHeld.promise;

      const addWhileCancelling = addRestaurantOrderItemViaZero({
        db: secondDb,
        zeroDb: secondZeroDb,
        ctx,
        input: { tableId, productId, quantity: 1 },
      });
      await waitForPostgresLock(db, secondBackend.pid);
      continueCancellation.resolve();

      const [cancellationResult, addResult] = await Promise.allSettled([
        cancellation,
        addWhileCancelling,
      ]);
      expect(cancellationResult.status).toBe("fulfilled");
      expect(addResult.status).toBe("rejected");

      const originalOrderItems = await db
        .select({ status: restaurantOrderItem.status })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, initialItem.orderId));
      expect(originalOrderItems).toEqual([{ status: "cancelled" }]);
    } finally {
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
  });

  test("simultaneous first orders use distinct organization order numbers", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    const firstDb = drizzle(firstClient, { schema }) as TestDb;
    const secondDb = drizzle(secondClient, { schema }) as TestDb;
    const releaseFirstOrder = createDeferred();

    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      await enableRestaurantModule(db, organizationId);
      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [firstTableId, secondTableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T3",
        }),
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T4",
        }),
        seedProduct(db, {
          organizationId,
          name: "Primera orden concurrente",
          price: 10_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const secondZeroDb = createZeroTestDb(secondDb);
      const ctx = createZeroContext(userId, organizationId);
      const [secondBackend] = await secondClient`
        SELECT pg_backend_pid() AS pid
      `;
      if (!secondBackend) {
        throw new Error("No se pudo identificar la segunda transacción.");
      }

      const firstOrderCreated = createDeferred();
      const firstOrder = firstDb.transaction(async (transaction) => {
        await runAddRestaurantOrderItem(
          transaction,
          {
            itemId: crypto.randomUUID(),
            tableId: firstTableId,
            productId,
            quantity: 1,
          },
          { organizationId, userId }
        );
        firstOrderCreated.resolve();
        await releaseFirstOrder.promise;
      });
      await firstOrderCreated.promise;

      const secondOrder = addRestaurantOrderItemViaZero({
        db: secondDb,
        zeroDb: secondZeroDb,
        ctx,
        input: { tableId: secondTableId, productId, quantity: 1 },
      });
      await waitForPostgresLock(db, secondBackend.pid);
      releaseFirstOrder.resolve();

      const [firstResult, secondResult] = await Promise.allSettled([
        firstOrder,
        secondOrder,
      ]);
      expect(firstResult.status).toBe("fulfilled");
      expect(secondResult.status).toBe("fulfilled");

      const orderRows = await db
        .select({ orderNumber: restaurantOrder.orderNumber })
        .from(restaurantOrder)
        .where(eq(restaurantOrder.organizationId, organizationId));
      expect(orderRows.map((order) => order.orderNumber).toSorted()).toEqual([
        1, 2,
      ]);
    } finally {
      releaseFirstOrder.resolve();
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
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

  test("simultaneous unassigned credit payments do not over-allocate the same sale", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    const firstDb = drizzle(firstClient, { schema }) as TestDb;
    const secondDb = drizzle(secondClient, { schema }) as TestDb;

    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const firstZeroDb = createZeroTestDb(firstDb);
      const secondZeroDb = createZeroTestDb(secondDb);
      const zeroCtx = createZeroContext(userId, organizationId);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Concurrent Credit Allocation",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Concurrent Allocation Customer",
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const firstSale = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );
      const secondSale = await createCoreSale(
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
      expect(accountRow?.balance).toBe(20_000);

      const results = await Promise.allSettled([
        registerCreditPaymentViaZero({
          zeroDb: firstZeroDb,
          ctx: zeroCtx,
          input: {
            shiftId,
            creditAccountId: accountRow.id,
            amount: 10_000,
            method: "cash",
          },
        }),
        registerCreditPaymentViaZero({
          zeroDb: secondZeroDb,
          ctx: zeroCtx,
          input: {
            shiftId,
            creditAccountId: accountRow.id,
            amount: 10_000,
            method: "cash",
          },
        }),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(
        true
      );

      const paymentRows = await db
        .select({
          appliedAmount: payment.appliedAmount,
          saleId: payment.saleId,
        })
        .from(payment)
        .where(eq(payment.organizationId, organizationId));
      const paidBySale = new Map<string, number>();
      for (const paymentRow of paymentRows) {
        if (!paymentRow.saleId) {
          continue;
        }
        paidBySale.set(
          paymentRow.saleId,
          (paidBySale.get(paymentRow.saleId) ?? 0) + paymentRow.appliedAmount
        );
      }

      expect(paidBySale.get(firstSale.saleId)).toBe(10_000);
      expect(paidBySale.get(secondSale.saleId)).toBe(10_000);

      const saleRows = await db
        .select({
          id: sale.id,
          status: sale.status,
          totalAmount: sale.totalAmount,
        })
        .from(sale)
        .where(eq(sale.customerId, customerId));
      for (const saleRow of saleRows) {
        expect(paidBySale.get(saleRow.id) ?? 0).toBeLessThanOrEqual(
          saleRow.totalAmount
        );
        expect(saleRow.status).toBe("completed");
      }

      const [updatedAccount] = await db
        .select({ balance: creditAccount.balance })
        .from(creditAccount)
        .where(eq(creditAccount.id, accountRow.id));
      expect(updatedAccount?.balance).toBe(0);
    } finally {
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
  });
});
