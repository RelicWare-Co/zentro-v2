import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import {
  creditAccount,
  creditTransaction,
} from "@/database/drizzle/schema/credit.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import { createCoreSale } from "@/features/sales/create-sale.server";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import {
  listCreditTransactionsViaZero,
  registerCreditPaymentViaZero,
  searchCreditAccountsViaZero,
} from "./helpers/zero-credit";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("credit ledger", () => {
  describe("VAL-CRED-001: credit account search returns customer data and balances", () => {
    test("search returns customer info and current balance", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Widget",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Alice",
          documentNumber: "123456",
          phone: "3001234567",
          email: "alice@example.com",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      const result = await searchCreditAccountsViaZero({
        zeroDb,
        ctx: zeroCtx,
      });
      expect(result.data.length).toBe(1);
      const account = result.data[0];
      expect(account.customerId).toBe(customerId);
      expect(account.balance).toBe(10_000);
      expect(account.customerName).toBe("Alice");
      expect(account.customerDocument).toBe("123456");
      expect(account.customerPhone).toBe("3001234567");
      expect(result.total).toBe(1);

      await cleanup();
    });

    test("search excludes accounts for soft-deleted customers", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Bob",
      });

      const now = new Date();
      await db.insert(creditAccount).values({
        id: crypto.randomUUID(),
        organizationId,
        customerId,
        balance: 5000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(customer)
        .set({ deletedAt: now })
        .where(eq(customer.id, customerId));

      const result = await searchCreditAccountsViaZero({
        zeroDb,
        ctx: zeroCtx,
      });
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);

      await cleanup();
    });

    test("search filters by customer name", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const [customerA, customerB] = await Promise.all([
        seedCustomer(db, {
          organizationId,
          name: "Alice",
        }),
        seedCustomer(db, {
          organizationId,
          name: "Bob",
        }),
      ]);

      const now = new Date();
      await db.insert(creditAccount).values([
        {
          id: crypto.randomUUID(),
          organizationId,
          customerId: customerA,
          balance: 1000,
          interestRate: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          organizationId,
          customerId: customerB,
          balance: 2000,
          interestRate: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await searchCreditAccountsViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { searchQuery: "Alice" },
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].customerName).toBe("Alice");
      expect(result.data[0].balance).toBe(1000);

      await cleanup();
    });
  });

  describe("VAL-CRED-002: transaction listing is in descending chronological order", () => {
    test("transactions ordered newest first", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Alice",
      });
      const accountId = crypto.randomUUID();

      const now = new Date();
      await db.insert(creditAccount).values({
        id: accountId,
        organizationId,
        customerId,
        balance: 15_000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      const t1Id = crypto.randomUUID();
      const t2Id = crypto.randomUUID();
      const t3Id = crypto.randomUUID();

      await db.insert(creditTransaction).values([
        {
          id: t1Id,
          organizationId,
          creditAccountId: accountId,
          type: "charge",
          amount: 5000,
          createdAt: new Date(now.getTime() - 2000),
        },
        {
          id: t2Id,
          organizationId,
          creditAccountId: accountId,
          type: "charge",
          amount: 5000,
          createdAt: new Date(now.getTime() - 1000),
        },
        {
          id: t3Id,
          organizationId,
          creditAccountId: accountId,
          type: "payment",
          amount: 3000,
          createdAt: now,
        },
      ]);

      const result = await listCreditTransactionsViaZero({
        zeroDb,
        ctx: zeroCtx,
        creditAccountId: accountId,
      });
      expect(result.data.length).toBe(3);
      expect(result.data[0].id).toBe(t3Id);
      expect(result.data[1].id).toBe(t2Id);
      expect(result.data[2].id).toBe(t1Id);
      expect(result.data[0].type).toBe("payment");
      expect(result.data[1].type).toBe("charge");
      expect(result.data[2].type).toBe("charge");

      await cleanup();
    });

    test("transactions respect the requested query limit", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Alice",
      });
      const accountId = crypto.randomUUID();

      const now = new Date();
      await db.insert(creditAccount).values({
        id: accountId,
        organizationId,
        customerId,
        balance: 35_000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      const transactionIds = Array.from({ length: 7 }, () =>
        crypto.randomUUID()
      );
      await db.insert(creditTransaction).values(
        transactionIds.map((id, index) => ({
          id,
          organizationId,
          creditAccountId: accountId,
          type: "charge",
          amount: 5000,
          createdAt: new Date(now.getTime() - index * 1000),
        }))
      );

      const result = await listCreditTransactionsViaZero({
        zeroDb,
        ctx: zeroCtx,
        creditAccountId: accountId,
        input: { limit: 5 },
      });
      expect(result.data.length).toBe(5);
      expect(result.data.map((transaction) => transaction.id)).toEqual(
        transactionIds.slice(0, 5)
      );

      await cleanup();
    });
  });

  describe("VAL-CRED-003: payment registration decreases balance and links to sale", () => {
    test("payment decreases balance and creates linked transaction", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Widget",
          price: 20_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Alice",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
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

      const accountRows = await db
        .select()
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );
      const accountId = accountRows[0].id;
      expect(accountRows[0].balance).toBe(15_000);

      const paymentResult = await registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountId,
          amount: 5000,
          method: "cash",
          saleId: saleResult.saleId,
        },
      });

      expect(paymentResult.amount).toBe(5000);
      expect(paymentResult.newBalance).toBe(10_000);
      expect(paymentResult.saleId).toBe(saleResult.saleId);

      const afterAccount = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(afterAccount[0].balance).toBe(10_000);

      const transactionRows = await db
        .select()
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.creditAccountId, accountId),
            eq(creditTransaction.type, "payment")
          )
        );
      expect(transactionRows.length).toBe(1);
      expect(transactionRows[0].amount).toBe(5000);
      expect(transactionRows[0].saleId).toBe(saleResult.saleId);
      expect(transactionRows[0].paymentId).toBe(paymentResult.paymentId);

      const saleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(saleRows[0].status).toBe("credit");

      const paymentResult2 = await registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountId,
          amount: 10_000,
          method: "cash",
          saleId: saleResult.saleId,
        },
      });

      expect(paymentResult2.newBalance).toBe(0);

      const saleRowsAfterFullPayment = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(saleRowsAfterFullPayment[0].status).toBe("completed");

      await cleanup();
    });

    test("partial payment keeps sale in credit status", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Widget",
          price: 20_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Alice",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
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

      const accountRows = await db
        .select()
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );
      const accountId = accountRows[0].id;

      await registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountId,
          amount: 3000,
          method: "cash",
          saleId: saleResult.saleId,
        },
      });

      const saleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(saleRows[0].status).toBe("credit");

      await cleanup();
    });

    test("payment without saleId still decreases balance", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Bob",
      });
      const now = new Date();

      const accountId = crypto.randomUUID();
      await db.insert(creditAccount).values({
        id: accountId,
        organizationId,
        customerId,
        balance: 8000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      const shiftId = await seedShift(db, {
        organizationId,
        userId,
        status: "open",
      });

      const paymentResult = await registerCreditPaymentViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          creditAccountId: accountId,
          amount: 3000,
          method: "cash",
        },
      });

      expect(paymentResult.newBalance).toBe(5000);
      expect(paymentResult.saleId).toBeNull();

      const transactionRows = await db
        .select()
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.creditAccountId, accountId),
            eq(creditTransaction.type, "payment")
          )
        );
      expect(transactionRows.length).toBe(1);
      expect(transactionRows[0].saleId).toBeNull();

      await cleanup();
    });
  });

  describe("VAL-CRED-004: overpayment rejection", () => {
    test("payment amount exceeding balance is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Alice",
      });
      const now = new Date();

      const accountId = crypto.randomUUID();
      await db.insert(creditAccount).values({
        id: accountId,
        organizationId,
        customerId,
        balance: 5000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      const shiftId = await seedShift(db, {
        organizationId,
        userId,
        status: "open",
      });

      await expect(
        registerCreditPaymentViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: {
            shiftId,
            creditAccountId: accountId,
            amount: 6000,
            method: "cash",
          },
        })
      ).rejects.toThrow("El abono no puede superar el saldo pendiente");

      await cleanup();
    });
  });

  describe("VAL-CRED-005: closed shift rejects credit payments", () => {
    test("payment on closed shift is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);
      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Alice",
      });
      const now = new Date();

      const accountId = crypto.randomUUID();
      await db.insert(creditAccount).values({
        id: accountId,
        organizationId,
        customerId,
        balance: 5000,
        interestRate: 0,
        createdAt: now,
        updatedAt: now,
      });

      const shiftId = await seedShift(db, {
        organizationId,
        userId,
        status: "closed",
        closedAt: now,
      });

      await expect(
        registerCreditPaymentViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: {
            shiftId,
            creditAccountId: accountId,
            amount: 1000,
            method: "cash",
          },
        })
      ).rejects.toThrow("No se puede registrar pago en un turno cerrado");

      await cleanup();
    });
  });
});
