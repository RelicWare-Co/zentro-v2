import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import {
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";
import {
  payment,
  sale,
  saleItem,
} from "@/database/drizzle/schema/sales.schema";
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

describe("audit trail", () => {
  test("sale creation creates complete audit chain: sale → saleItems → payments → inventoryMovements", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Audited Item",
        price: 10_000,
        taxRate: 19,
        stock: 50,
        trackInventory: true,
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const result = await createCoreSale(
      {
        shiftId,
        items: [{ productId, quantity: 3, unitPrice: 10_000 }],
        payments: [{ method: "cash", amount: 35_700 }],
      },
      { db, organizationId, userId }
    );

    const [saleRow] = await db
      .select()
      .from(sale)
      .where(eq(sale.id, result.saleId));
    expect(saleRow).toBeDefined();
    expect(saleRow?.status).toBe("completed");

    const items = await db
      .select()
      .from(saleItem)
      .where(eq(saleItem.saleId, result.saleId));
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);

    const payments = await db
      .select()
      .from(payment)
      .where(eq(payment.saleId, result.saleId));
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount).toBe(35_700);

    const movements = await db
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, productId));
    expect(movements).toHaveLength(1);
    expect(movements[0]?.type).toBe("sale");
    expect(movements[0]?.quantity).toBe(-3);
    expect(movements[0]?.notes).toContain(result.saleId);

    await cleanup();
  });

  test("credit sale creates credit account, charge transaction, and links to sale", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Credit Item",
        price: 15_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, {
        organizationId,
        name: "Audit Customer",
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const result = await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 2, unitPrice: 15_000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    const [accountRow] = await db
      .select()
      .from(creditAccount)
      .where(eq(creditAccount.customerId, customerId));
    expect(accountRow).toBeDefined();
    expect(accountRow?.balance).toBe(30_000);

    const transactions = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.creditAccountId, accountRow?.id),
          eq(creditTransaction.type, "charge")
        )
      );
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.saleId).toBe(result.saleId);
    expect(transactions[0]?.amount).toBe(30_000);

    await cleanup();
  });

  test("cancellation creates reversal chain: sale status, inventory restored, credit reversed", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Cancel Audit",
        price: 10_000,
        stock: 20,
        trackInventory: true,
      }),
      seedCustomer(db, {
        organizationId,
        name: "Cancel Customer",
      }),
      seedShift(db, { organizationId, userId, status: "open" }),
    ]);

    const result = await createCoreSale(
      {
        shiftId,
        customerId,
        items: [{ productId, quantity: 5, unitPrice: 10_000 }],
        payments: [],
        isCreditSale: true,
      },
      { db, organizationId, userId }
    );

    const stockAfterSale = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, productId));
    expect(stockAfterSale[0]?.stock).toBe(15);

    await cancelSaleViaZero({
      zeroDb,
      ctx: zeroCtx,
      input: { saleId: result.saleId },
    });

    const [saleRow] = await db
      .select({ status: sale.status })
      .from(sale)
      .where(eq(sale.id, result.saleId));
    expect(saleRow?.status).toBe("cancelled");

    const stockAfterCancel = await db
      .select({ stock: product.stock })
      .from(product)
      .where(eq(product.id, productId));
    expect(stockAfterCancel[0]?.stock).toBe(20);

    const movements = await db
      .select()
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, productId));
    expect(movements).toHaveLength(2);
    expect(movements[0]?.type).toBe("sale");
    expect(movements[0]?.quantity).toBe(-5);
    expect(movements[1]?.type).toBe("adjustment");
    expect(movements[1]?.quantity).toBe(5);
    expect(movements[1]?.notes).toContain(result.saleId);

    const reversalTransactions = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.saleId, result.saleId),
          eq(creditTransaction.type, "reversal")
        )
      );
    expect(reversalTransactions).toHaveLength(1);
    expect(reversalTransactions[0]?.amount).toBe(50_000);

    const [accountRow] = await db
      .select({ balance: creditAccount.balance })
      .from(creditAccount)
      .where(eq(creditAccount.customerId, customerId));
    expect(accountRow?.balance).toBe(0);

    await cleanup();
  });

  test("credit payment creates payment row, credit transaction, and updates sale status", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const zeroCtx = createZeroContext(userId, organizationId);
    const [productId, customerId, shiftId] = await Promise.all([
      seedProduct(db, {
        organizationId,
        name: "Payment Audit",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      }),
      seedCustomer(db, {
        organizationId,
        name: "Payment Customer",
      }),
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

    const payments = await db
      .select()
      .from(payment)
      .where(eq(payment.saleId, saleResult.saleId));
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amount).toBe(10_000);

    const paymentTransactions = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.creditAccountId, accountRow?.id),
          eq(creditTransaction.type, "payment")
        )
      );
    expect(paymentTransactions).toHaveLength(1);
    expect(paymentTransactions[0]?.amount).toBe(10_000);
    expect(paymentTransactions[0]?.saleId).toBe(saleResult.saleId);

    const [updatedSale] = await db
      .select({ status: sale.status })
      .from(sale)
      .where(eq(sale.id, saleResult.saleId));
    expect(updatedSale?.status).toBe("completed");

    const [updatedAccount] = await db
      .select({ balance: creditAccount.balance })
      .from(creditAccount)
      .where(eq(creditAccount.id, accountRow?.id));
    expect(updatedAccount?.balance).toBe(0);

    await cleanup();
  });
});
