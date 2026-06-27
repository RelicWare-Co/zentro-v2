import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { creditAccount } from "@/database/drizzle/schema/credit.schema";
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

describe("error recovery", () => {
  test("cancel sale with registered payments is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Paid Item",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const result = await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 10_000 }],
      },
      { db, organizationId, userId }
    );

    await expect(
      cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: result.saleId },
      })
    ).rejects.toThrow("cobros registrados");

    await cleanup();
  });

  test("cancel credit sale with partial payment is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Partial Pay",
        price: 20_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Partial Customer" }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const saleResult = await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 20_000 }],
        payments: [{ method: "cash", amount: 5000 }],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    await expect(
      cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      })
    ).rejects.toThrow("cobros registrados");

    await cleanup();
  });

  test("double cancellation is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Double Cancel",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Cancel Customer" }),
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

    await cancelSaleViaZero({
      zeroDb,
      ctx: zeroCtx,
      input: { saleId: saleResult.saleId },
    });

    await expect(
      cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      })
    ).rejects.toThrow("ya está anulada");

    await cleanup();
  });

  test("credit payment exceeding balance is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Overpay Credit",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Overpay Customer" }),
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

    await expect(
      registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountRow?.id,
          saleId: saleResult.saleId,
          amount: 15_000,
          method: "cash",
        },
      })
    ).rejects.toThrow("no puede superar el saldo pendiente");

    await cleanup();
  });

  test("credit payment on zero balance is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Zero Balance",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, { organizationId, name: "Zero Balance Customer" }),
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

    await registerCreditPaymentViaZero({
      zeroDb,
      ctx: zeroCtx,
      input: {
        shiftId,
        creditAccountId: accountRow?.id,
        saleId: saleResult.saleId,
        amount: 10_000,
        method: "cash",
      },
    });

    await expect(
      registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountRow?.id,
          saleId: null,
          amount: 1000,
          method: "cash",
        },
      })
    ).rejects.toThrow("no tiene saldo pendiente");

    await cleanup();
  });

  test("sale with non-existent customer is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "No Customer",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    await expect(
      createCoreSale(
        {
          shiftId,
          customerId: "non-existent-customer-id",
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 10_000 }],
        },
        { db, organizationId, userId }
      )
    ).rejects.toThrow("cliente seleccionado no existe");

    await cleanup();
  });

  test("sale with soft-deleted product is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Deleted Product",
        price: 10_000,
        stock: 10,
        trackInventory: true,
        deletedAt: new Date(),
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    await expect(
      createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 10_000 }],
        },
        { db, organizationId, userId }
      )
    ).rejects.toThrow("no encontrado o inactivo");

    await cleanup();
  });
});
