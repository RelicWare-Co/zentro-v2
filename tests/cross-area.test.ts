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
import { payment, sale } from "@/database/drizzle/schema/sales.schema";
import { createServerORPCClient } from "@/server/orpc/client/server";
import { createCoreSale } from "@/server/sales/create-sale.server";
import { buildMockContext } from "./helpers/orpc-context";
import {
  makeUser,
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("cross-area end-to-end flows", () => {
  describe("VAL-CROSS-001: full POS checkout flow works end-to-end and data is consistent across queries", () => {
    test("checkout flow: open shift, add product, create sale, close shift, verify consistency", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Step 1: Open shift
      const shiftOpen = await client.shifts.open({ startingCash: 10_000 });
      const shiftId = shiftOpen.id;
      expect(shiftOpen.status).toBe("open");
      expect(shiftOpen.startingCash).toBe(10_000);

      // Step 2: Seed tracked product and verify stock
      const productId = await seedProduct(db, {
        organizationId,
        name: "Coffee Mug",
        price: 12_000,
        stock: 30,
        trackInventory: true,
      });

      const beforeStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(beforeStock[0].stock).toBe(30);

      // Step 3: Create sale through oRPC (with cash overpayment covering change)
      const saleResult = await client.sales.create({
        shiftId,
        items: [{ productId, quantity: 2, unitPrice: 12_000 }],
        payments: [{ method: "cash", amount: 25_000 }],
      });

      expect(saleResult.status).toBe("completed");
      expect(saleResult.totalAmount).toBe(24_000);
      expect(saleResult.paidAmount).toBe(25_000);
      expect(saleResult.balanceDue).toBe(0);

      // Step 4: Verify stock decremented
      const afterStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterStock[0].stock).toBe(28);

      // Step 5: Verify inventory movement was recorded
      const movementRows = await db
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.productId, productId),
            eq(inventoryMovement.type, "sale")
          )
        );
      expect(movementRows.length).toBe(1);
      expect(movementRows[0].quantity).toBe(-2);

      // Step 6: Verify payment records
      const paymentRows = await db
        .select()
        .from(payment)
        .where(eq(payment.saleId, saleResult.saleId));
      expect(paymentRows.length).toBe(1);
      expect(paymentRows[0].method).toBe("cash");
      expect(paymentRows[0].amount).toBe(25_000);
      expect(paymentRows[0].shiftId).toBe(shiftId);

      // Step 7: Verify sale appears in sales list
      const salesList = await client.sales.list({
        cashierId: userId,
        limit: 10,
      });
      expect(salesList.data.length).toBe(1);
      expect(salesList.data[0].id).toBe(saleResult.saleId);
      expect(salesList.data[0].status).toBe("completed");
      expect(salesList.data[0].totalAmount).toBe(24_000);
      expect(salesList.data[0].paidAmount).toBe(25_000);
      expect(salesList.data[0].balanceDue).toBe(0);
      expect(salesList.data[0].itemCount).toBe(2);
      expect(salesList.data[0].paymentMethods).toContain("cash");
      expect(salesList.total).toBe(1);

      // Step 8: Verify shift history reflects the sale
      const shiftsList = await client.shifts.list({
        status: "open",
        limit: 10,
      });
      expect(shiftsList.data.length).toBe(1);
      const shiftRow = shiftsList.data[0];
      expect(shiftRow.id).toBe(shiftId);
      expect(shiftRow.status).toBe("open");
      expect(shiftRow.operations.paidSalesCount).toBe(1);
      expect(shiftRow.operations.paidSalesAmount).toBe(24_000);
      expect(shiftRow.totals.totalPayments).toBe(25_000);
      expect(shiftRow.paymentBreakdown.length).toBe(1);
      expect(shiftRow.paymentBreakdown[0].method).toBe("cash");
      // paymentBreakdown includes startingCash (10000) + cash after change (24000)
      expect(shiftRow.paymentBreakdown[0].amount).toBe(34_000);

      // Step 9: Close summary expected cash = startingCash + cashSales - change
      // = 10000 + 25000 - 1000 = 34000
      const closeSummary = await client.shifts.closeSummary({ shiftId });
      const cashSummary = closeSummary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash"
      );
      expect(cashSummary).toBeDefined();
      expect(cashSummary?.expectedAmount).toBe(34_000);
      expect(closeSummary.totalExpected).toBe(34_000);

      // Step 10: Close shift
      const closeResult = await client.shifts.close({
        shiftId,
        closures: [{ paymentMethod: "cash", actualAmount: 34_000 }],
      });
      expect(closeResult.shiftId).toBe(shiftId);
      expect(closeResult.closures.length).toBe(1);
      expect(closeResult.closures[0].paymentMethod).toBe("cash");
      expect(closeResult.closures[0].expectedAmount).toBe(34_000);
      expect(closeResult.closures[0].actualAmount).toBe(34_000);
      expect(closeResult.closures[0].difference).toBe(0);

      // Step 11: After closing, verify shift status changed
      const closedShiftDetail = await client.shifts.detail({ shiftId });
      expect(closedShiftDetail.status).toBe("closed");
      expect(closedShiftDetail.totals.totalPayments).toBe(25_000);
      expect(closedShiftDetail.totals.totalExpected).toBe(34_000);
      expect(closedShiftDetail.totals.totalActual).toBe(34_000);
      expect(closedShiftDetail.totals.totalDifference).toBe(0);
      expect(closedShiftDetail.operations.paidSalesCount).toBe(1);
      expect(closedShiftDetail.operations.paidSalesAmount).toBe(24_000);

      // Step 12: Verify sale detail still consistent
      const saleDetail = await client.sales.detail({
        saleId: saleResult.saleId,
      });
      expect(saleDetail).not.toBeNull();
      expect(saleDetail?.status).toBe("completed");
      expect(saleDetail?.totalAmount).toBe(24_000);
      expect(saleDetail?.paidAmount).toBe(25_000);
      expect(saleDetail?.balanceDue).toBe(0);
      expect(saleDetail?.shift?.id).toBe(shiftId);
      expect(saleDetail?.items.length).toBe(1);
      expect(saleDetail?.items[0].name).toBe("Coffee Mug");
      expect(saleDetail?.items[0].quantity).toBe(2);
      expect(saleDetail?.payments.length).toBe(1);
      expect(saleDetail?.payments[0].method).toBe("cash");
      expect(saleDetail?.payments[0].amount).toBe(25_000);

      await cleanup();
    });

    test("checkout flow with cash movement, card sale, and mixed payments is consistent", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Open shift
      const shiftOpen = await client.shifts.open({ startingCash: 5000 });
      const shiftId = shiftOpen.id;

      // Seed products
      const [productA, productB] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Soda",
          price: 5000,
          stock: 20,
          trackInventory: true,
        }),
        seedProduct(db, {
          organizationId,
          name: "Chips",
          price: 3000,
          stock: 15,
          trackInventory: true,
        }),
      ]);

      // Cash movement
      await client.shifts.cashMovement({
        shiftId,
        type: "inflow",
        paymentMethod: "cash",
        amount: 2000,
        description: "Extra inflow",
      });

      // Sale 1: cash payment
      await client.sales.create({
        shiftId,
        items: [{ productId: productA, quantity: 1, unitPrice: 5000 }],
        payments: [{ method: "cash", amount: 5000 }],
      });

      // Sale 2: card payment
      await client.sales.create({
        shiftId,
        items: [{ productId: productB, quantity: 2, unitPrice: 3000 }],
        payments: [{ method: "card", amount: 6000 }],
      });

      // Verify stock
      const [stockA, stockB] = await Promise.all([
        db
          .select({ stock: product.stock })
          .from(product)
          .where(eq(product.id, productA)),
        db
          .select({ stock: product.stock })
          .from(product)
          .where(eq(product.id, productB)),
      ]);
      expect(stockA[0].stock).toBe(19);
      expect(stockB[0].stock).toBe(13);

      // Verify shift detail
      const shiftDetail = await client.shifts.detail({ shiftId });
      expect(shiftDetail.operations.paidSalesCount).toBe(2);
      expect(shiftDetail.operations.paidSalesAmount).toBe(11_000);
      expect(shiftDetail.totals.totalPayments).toBe(11_000); // 5000 + 6000 (payments only, movements excluded)
      expect(shiftDetail.paymentBreakdown.length).toBe(2);

      const cashBreakdown = shiftDetail.paymentBreakdown.find(
        (p: { method: string }) => p.method === "cash"
      );
      const cardBreakdown = shiftDetail.paymentBreakdown.find(
        (p: { method: string }) => p.method === "card"
      );
      expect(cashBreakdown).toBeDefined();
      expect(cashBreakdown?.amount).toBe(12_000); // 5000 starting + 5000 sale + 2000 inflow
      expect(cardBreakdown).toBeDefined();
      expect(cardBreakdown?.amount).toBe(6000);

      // Verify close summary
      const closeSummary = await client.shifts.closeSummary({ shiftId });
      const cashSummary = closeSummary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash"
      );
      const cardSummary = closeSummary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "card"
      );
      expect(cashSummary?.expectedAmount).toBe(12_000); // 5000 starting + 7000 cash
      expect(cardSummary?.expectedAmount).toBe(6000);
      expect(closeSummary.totalExpected).toBe(18_000);

      // Close shift
      const closeResult = await client.shifts.close({
        shiftId,
        closures: [
          { paymentMethod: "cash", actualAmount: 12_000 },
          { paymentMethod: "card", actualAmount: 6000 },
        ],
      });
      expect(closeResult.closures.length).toBe(2);
      expect(
        closeResult.closures.every(
          (c: { difference: number }) => c.difference === 0
        )
      ).toBe(true);

      // Verify sales list shows both sales
      const salesList = await client.sales.list({ limit: 10 });
      expect(salesList.data.length).toBe(2);
      expect(salesList.total).toBe(2);

      await cleanup();
    });
  });

  describe("VAL-CROSS-002: credit sale flow works end-to-end", () => {
    test("create credit sale, register payment, verify balance reaches zero", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Step 1: Open shift
      const shiftOpen = await client.shifts.open({ startingCash: 5000 });
      const shiftId = shiftOpen.id;

      // Step 2: Seed product and customer
      const [productId, customerId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Gadget",
          price: 30_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Jane Doe",
        }),
      ]);

      // Step 3: Create credit sale (pay 5000 cash, 25000 on credit)
      const saleResult = await client.sales.create({
        shiftId,
        customerId,
        items: [{ productId, quantity: 1, unitPrice: 30_000 }],
        payments: [{ method: "cash", amount: 5000 }],
        isCreditSale: true,
      });

      expect(saleResult.status).toBe("credit");
      expect(saleResult.totalAmount).toBe(30_000);
      expect(saleResult.paidAmount).toBe(5000);
      expect(saleResult.balanceDue).toBe(25_000);

      // Step 4: Verify credit account created with correct balance
      const accountRows = await db
        .select()
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );
      expect(accountRows.length).toBe(1);
      const accountId = accountRows[0].id;
      expect(accountRows[0].balance).toBe(25_000);

      // Step 5: Verify charge transaction exists
      const chargeRows = await db
        .select()
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.creditAccountId, accountId),
            eq(creditTransaction.type, "charge")
          )
        );
      expect(chargeRows.length).toBe(1);
      expect(chargeRows[0].amount).toBe(25_000);
      expect(chargeRows[0].saleId).toBe(saleResult.saleId);

      // Step 6: Verify stock decremented
      const afterStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterStock[0].stock).toBe(9);

      // Step 7: Register first partial credit payment (10000)
      const payment1 = await client.credit.registerPayment({
        shiftId,
        creditAccountId: accountId,
        amount: 10_000,
        method: "cash",
        saleId: saleResult.saleId,
      });

      expect(payment1.newBalance).toBe(15_000);
      expect(payment1.saleId).toBe(saleResult.saleId);

      // Step 8: Verify balance updated
      const afterPayment1 = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(afterPayment1[0].balance).toBe(15_000);

      // Step 9: Verify payment transaction created
      const paymentRows = await db
        .select()
        .from(creditTransaction)
        .where(
          and(
            eq(creditTransaction.creditAccountId, accountId),
            eq(creditTransaction.type, "payment")
          )
        );
      expect(paymentRows.length).toBe(1);
      expect(paymentRows[0].amount).toBe(10_000);
      expect(paymentRows[0].saleId).toBe(saleResult.saleId);

      // Step 10: Verify sale still in credit status
      const saleAfterPartial = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(saleAfterPartial[0].status).toBe("credit");

      // Step 11: Register second partial payment (remaining 15000)
      const payment2 = await client.credit.registerPayment({
        shiftId,
        creditAccountId: accountId,
        amount: 15_000,
        method: "cash",
        saleId: saleResult.saleId,
      });

      expect(payment2.newBalance).toBe(0);

      // Step 12: Verify balance is zero
      const afterPayment2 = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(afterPayment2[0].balance).toBe(0);

      // Step 13: Verify sale status changed to completed
      const saleAfterFull = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(saleAfterFull[0].status).toBe("completed");

      // Step 14: Verify credit account search shows zero balance
      const accountSearch = await client.credit.searchAccounts({});
      const foundAccount = accountSearch.data.find(
        (a: { customerId: string }) => a.customerId === customerId
      );
      expect(foundAccount).toBeDefined();
      expect(foundAccount?.balance).toBe(0);

      // Step 15: Verify transaction listing shows both charge and payments in correct order
      const txList = await client.credit.transactions({
        creditAccountId: accountId,
      });
      expect(txList.data.length).toBe(3);
      expect(txList.data[0].type).toBe("payment"); // most recent
      expect(txList.data[0].amount).toBe(15_000);
      expect(txList.data[1].type).toBe("payment");
      expect(txList.data[1].amount).toBe(10_000);
      expect(txList.data[2].type).toBe("charge");
      expect(txList.data[2].amount).toBe(25_000);

      await cleanup();
    });

    test("credit sale with no initial payment, full payment brings balance to zero", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const shiftOpen = await client.shifts.open({ startingCash: 0 });
      const shiftId = shiftOpen.id;

      const [productId, customerId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Premium Item",
          price: 50_000,
          stock: 5,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "John Credit",
        }),
      ]);

      // Credit sale with no initial payment
      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 50_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      expect(saleResult.status).toBe("credit");
      expect(saleResult.totalAmount).toBe(50_000);
      expect(saleResult.balanceDue).toBe(50_000);

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
      expect(accountRows[0].balance).toBe(50_000);

      // Full payment in one go
      const paymentResult = await client.credit.registerPayment({
        shiftId,
        creditAccountId: accountId,
        amount: 50_000,
        method: "cash",
        saleId: saleResult.saleId,
      });

      expect(paymentResult.newBalance).toBe(0);
      expect(paymentResult.saleId).toBe(saleResult.saleId);

      const finalAccount = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(finalAccount[0].balance).toBe(0);

      const finalSale = await db
        .select()
        .from(sale)
        .where(eq(sale.id, saleResult.saleId));
      expect(finalSale[0].status).toBe("completed");

      await cleanup();
    });

    test("multiple credit sales for same customer, payments reduce total balance correctly", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const shiftOpen = await client.shifts.open({ startingCash: 0 });
      const shiftId = shiftOpen.id;

      const [productId, customerId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Widget",
          price: 10_000,
          stock: 20,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Multi Credit",
        }),
      ]);

      // Two credit sales (sequential to avoid SQLite BUSY on a single test DB connection)
      const sale1 = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );
      expect(sale1.saleId).toBeDefined();
      const sale2 = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [],
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
      expect(accountRows[0].balance).toBe(20_000);

      // Pay off first sale via saleId
      await client.credit.registerPayment({
        shiftId,
        creditAccountId: accountId,
        amount: 10_000,
        method: "cash",
        saleId: sale1.saleId,
      });

      const afterPay1 = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(afterPay1[0].balance).toBe(10_000);

      // Pay off remaining balance
      await client.credit.registerPayment({
        shiftId,
        creditAccountId: accountId,
        amount: 10_000,
        method: "cash",
        saleId: sale2.saleId,
      });

      const afterPay2 = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.id, accountId));
      expect(afterPay2[0].balance).toBe(0);

      // Both sales should be completed
      const saleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.customerId, customerId));
      expect(saleRows.length).toBe(2);
      expect(saleRows.every((s) => s.status === "completed")).toBe(true);

      // Account search shows zero
      const search = await client.credit.searchAccounts({});
      const acc = search.data.find(
        (a: { customerId: string }) => a.customerId === customerId
      );
      expect(acc).toBeDefined();
      expect(acc?.balance).toBe(0);

      await cleanup();
    });
  });
});
