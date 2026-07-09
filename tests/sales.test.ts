import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
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
import { serializeOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import {
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { cancelSaleViaZero } from "./helpers/zero-sales";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

describe("sale creation transactions", () => {
  describe("VAL-SALE-001: createCoreSale decrements stock for tracked products", () => {
    test("stock is reduced by sold quantity after sale", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Widget",
          price: 10_000,
          stock: 50,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const before = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(before[0].stock).toBe(50);

      await createCoreSale(
        {
          shiftId,
          items: [
            {
              productId,
              quantity: 3,
              unitPrice: 10_000,
            },
          ],
          payments: [{ method: "cash", amount: 30_000 }],
        },
        { db, organizationId, userId }
      );

      const after = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(after[0].stock).toBe(47);

      await cleanup();
    });

    test("modifier stock is reduced by total quantity sold", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [baseProductId, modifierProductId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Burger",
          price: 15_000,
          stock: 20,
          trackInventory: true,
        }),
        seedProduct(db, {
          organizationId,
          name: "Extra Cheese",
          price: 2000,
          stock: 30,
          trackInventory: true,
          isModifier: true,
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
          items: [
            {
              productId: baseProductId,
              quantity: 2,
              unitPrice: 15_000,
              modifiers: [
                {
                  modifierProductId,
                  quantity: 1,
                  unitPrice: 2000,
                },
              ],
            },
          ],
          payments: [{ method: "cash", amount: 34_000 }],
        },
        { db, organizationId, userId }
      );

      const [baseRow, modifierRow] = await Promise.all([
        db
          .select({ stock: product.stock })
          .from(product)
          .where(eq(product.id, baseProductId)),
        db
          .select({ stock: product.stock })
          .from(product)
          .where(eq(product.id, modifierProductId)),
      ]);

      expect(baseRow[0].stock).toBe(18); // 20 - 2
      expect(modifierRow[0].stock).toBe(28); // 30 - (2*1)

      await cleanup();
    });

    test("non-tracked product does not affect stock", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Service",
          price: 50_000,
          stock: 0,
          trackInventory: false,
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
          items: [{ productId, quantity: 1, unitPrice: 50_000 }],
          payments: [{ method: "cash", amount: 50_000 }],
        },
        { db, organizationId, userId }
      );

      const movements = await db
        .select()
        .from(inventoryMovement)
        .where(eq(inventoryMovement.productId, productId));
      expect(movements.length).toBe(0);

      await cleanup();
    });

    test("tracked product sale rejects when stock is insufficient", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Limited Item",
          price: 10_000,
          stock: 1,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      let threw = false;
      try {
        await createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 2, unitPrice: 10_000 }],
            payments: [{ method: "cash", amount: 20_000 }],
          },
          { db, organizationId, userId }
        );
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);

      const productRows = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(productRows[0].stock).toBe(1);

      await cleanup();
    });
  });

  describe("VAL-SALE-002: sale creation validates payment totals", () => {
    test("payment records created and sum equals sale total", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 12_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 12_000 }],
          payments: [
            { method: "cash", amount: 7000 },
            { method: "card", amount: 5000 },
          ],
        },
        { db, organizationId, userId }
      );

      expect(result.totalAmount).toBe(12_000);
      expect(result.paidAmount).toBe(12_000);
      expect(result.balanceDue).toBe(0);

      const paymentRows = await db
        .select()
        .from(payment)
        .where(eq(payment.saleId, result.saleId));
      expect(paymentRows.length).toBe(2);
      const totalPayments = paymentRows.reduce((s, p) => s + p.amount, 0);
      expect(totalPayments).toBe(12_000);

      await cleanup();
    });

    test("underpayment is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 15_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 15_000 }],
            payments: [{ method: "cash", amount: 10_000 }],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow(
        "La suma de los pagos debe ser igual al total de la venta"
      );

      await cleanup();
    });

    test("zero-total sale accepts no payments", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Freebie",
          price: 0,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 0 }],
          payments: [],
        },
        { db, organizationId, userId }
      );

      expect(result.totalAmount).toBe(0);
      expect(result.paidAmount).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-SALE-003: credit sale creates credit account and charge transaction", () => {
    test("credit sale for new customer creates account and charge transaction", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 25_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "John",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 25_000 }],
          payments: [{ method: "cash", amount: 5000 }],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      expect(result.status).toBe("credit");
      expect(result.totalAmount).toBe(25_000);
      expect(result.paidAmount).toBe(5000);
      expect(result.balanceDue).toBe(20_000);

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
      expect(accountRows[0].balance).toBe(20_000);

      const transactionRows = await db
        .select()
        .from(creditTransaction)
        .where(eq(creditTransaction.saleId, result.saleId));
      expect(transactionRows.length).toBe(1);
      expect(transactionRows[0].type).toBe("charge");
      expect(transactionRows[0].amount).toBe(20_000);

      await cleanup();
    });

    test("credit sale for existing customer increments balance", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Jane",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      // First credit sale
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

      // Second credit sale
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
      expect(accountRows[0].balance).toBe(20_000);

      await cleanup();
    });

    test("credit sale without customer is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [],
            isCreditSale: true,
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow(
        "Una venta a crédito requiere seleccionar un cliente registrado"
      );

      await cleanup();
    });

    test("credit sale with full payment is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Bob",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            customerId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [{ method: "cash", amount: 10_000 }],
            isCreditSale: true,
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow(
        "La venta marcada como crédito debe dejar un saldo pendiente por cobrar"
      );

      await cleanup();
    });
  });

  describe("VAL-SALE-004: sale cancellation restores stock and creates adjustment movement", () => {
    test("cancelling sale restores stock and records adjustment movement", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 20,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Cancellation Customer",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 5, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );
      expect(saleResult.saleId).toBeDefined();

      const afterSale = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterSale[0].stock).toBe(15);

      await cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      });

      const afterCancel = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterCancel[0].stock).toBe(20);

      const adjustmentRows = await db
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.productId, productId),
            eq(inventoryMovement.type, "adjustment")
          )
        );
      expect(adjustmentRows.length).toBe(1);
      expect(adjustmentRows[0].quantity).toBe(5);

      await cleanup();
    });

    test("cancelling already cancelled sale is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Already Cancelled Customer",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

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
      ).rejects.toThrow("La venta ya está anulada");

      await cleanup();
    });

    test("cancelling restores stock that was tracked at sale time", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Tracked Then Disabled",
          price: 10_000,
          stock: 20,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Tracked Customer",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 5, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      await db
        .update(product)
        .set({ trackInventory: false })
        .where(eq(product.id, productId));

      await cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      });

      const productRows = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(productRows[0].stock).toBe(20);

      const adjustmentRows = await db
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.productId, productId),
            eq(inventoryMovement.type, "adjustment")
          )
        );
      expect(adjustmentRows).toHaveLength(1);
      expect(adjustmentRows[0].quantity).toBe(5);

      await cleanup();
    });

    test("cancelling does not restore stock when sale did not move inventory", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Untracked Then Enabled",
          price: 10_000,
          stock: 20,
          trackInventory: false,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Untracked Customer",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 5, unitPrice: 10_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      await db
        .update(product)
        .set({ trackInventory: true })
        .where(eq(product.id, productId));

      await cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      });

      const productRows = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(productRows[0].stock).toBe(20);

      const adjustmentRows = await db
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.productId, productId),
            eq(inventoryMovement.type, "adjustment")
          )
        );
      expect(adjustmentRows).toHaveLength(0);

      await cleanup();
    });
  });

  describe("VAL-SALE-005: sale cancellation reverts credit balance", () => {
    test("credit sale cancellation reduces credit account balance", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
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
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 30_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );
      expect(saleResult.saleId).toBeDefined();

      const accountBefore = await db
        .select()
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );
      expect(accountBefore[0].balance).toBe(30_000);

      await cancelSaleViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { saleId: saleResult.saleId },
      });

      const accountAfter = await db
        .select()
        .from(creditAccount)
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );
      expect(accountAfter[0].balance).toBe(0);

      const transactionRows = await db
        .select({
          amount: creditTransaction.amount,
          saleId: creditTransaction.saleId,
          type: creditTransaction.type,
        })
        .from(creditTransaction)
        .where(eq(creditTransaction.saleId, saleResult.saleId));
      expect(transactionRows).toEqual(
        expect.arrayContaining([
          {
            amount: 30_000,
            saleId: saleResult.saleId,
            type: "charge",
          },
          {
            amount: 30_000,
            saleId: saleResult.saleId,
            type: "reversal",
          },
        ])
      );

      await cleanup();
    });
  });

  describe("VAL-SALE-006: closed shift rejects new sales", () => {
    test("sale creation on closed shift is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, closedShiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "closed",
          closedAt: new Date(),
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId: closedShiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [{ method: "cash", amount: 10_000 }],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow("No se puede registrar una venta en un turno cerrado");

      await cleanup();
    });
  });

  describe("VAL-SALE-007: wrong-user shift rejects sale", () => {
    test("sale creation on another user's shift is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId: ownerId }, { userId: cashierId }] =
        await Promise.all([
          seedOrganizationWithMember(db, { userEmail: "owner@example.com" }),
          seedOrganizationWithMember(db, {
            orgName: "Same Org",
            userEmail: "cashier@example.com",
            memberRole: "member",
          }),
        ]);
      // Add cashier as member of the same organization
      const memberId = crypto.randomUUID();
      const now = new Date();
      await db
        .insert(
          await import("../database/drizzle/schema/auth.schema").then(
            (m) => m.member
          )
        )
        .values({
          id: memberId,
          organizationId,
          userId: cashierId,
          role: "member",
          createdAt: now,
        });

      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId: ownerId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [{ method: "cash", amount: 10_000 }],
          },
          { db, organizationId, userId: cashierId }
        )
      ).rejects.toThrow("Solo el cajero del turno puede registrar ventas");

      await cleanup();
    });
  });

  describe("VAL-SALE-008: disabled payment methods are rejected", () => {
    test("sale with disabled payment method is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      // Disable card payments
      const settings = {
        pos: {
          paymentMethods: [{ id: "card", enabled: false }],
        },
      };
      await db
        .update(organization)
        .set({
          metadata: serializeOrganizationSettingsMetadata(
            settings as Parameters<
              typeof serializeOrganizationSettingsMetadata
            >[0]
          ),
        })
        .where(eq(organization.id, organizationId));

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [{ method: "card", amount: 10_000 }],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow("Método de pago no habilitado: card");

      await cleanup();
    });
  });

  describe("VAL-SALE-009: cash overpayment rules", () => {
    test("valid cash overpayment is allowed", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 12_000 }],
        },
        { db, organizationId, userId }
      );

      expect(result.totalAmount).toBe(10_000);
      expect(result.paidAmount).toBe(10_000);

      await cleanup();
    });

    test("overpayment with non-cash exceeding total is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [
              { method: "card", amount: 12_000 },
              { method: "cash", amount: 2000 },
            ],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow(
        "La suma de los pagos debe ser igual al total de la venta"
      );

      await cleanup();
    });

    test("overpayment without cash is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            payments: [{ method: "card", amount: 12_000 }],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow(
        "La suma de los pagos debe ser igual al total de la venta"
      );

      await cleanup();
    });
  });

  describe("VAL-SALE-010: credit settings are enforced", () => {
    test("credit sale is rejected when credit sales are disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Carlos",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const settings = {
        credit: { allowCreditSales: false },
      };
      await db
        .update(organization)
        .set({
          metadata: serializeOrganizationSettingsMetadata(
            settings as Parameters<
              typeof serializeOrganizationSettingsMetadata
            >[0]
          ),
        })
        .where(eq(organization.id, organizationId));

      // try/catch instead of expect().rejects: bun test on Windows deadlocks
      // when a transaction promise is passed to expect().rejects.
      let creditRejectionMessage = "";
      try {
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
      } catch (error) {
        creditRejectionMessage = (error as Error).message;
      }
      expect(creditRejectionMessage).toBe(
        "Las ventas a crédito no están habilitadas en la organización"
      );

      const accountRows = await db
        .select()
        .from(creditAccount)
        .where(eq(creditAccount.organizationId, organizationId));
      expect(accountRows.length).toBe(0);

      await cleanup();
    });

    test("new credit account uses the organization default interest rate", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Diana",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const settings = {
        credit: { allowCreditSales: true, defaultInterestRate: 3 },
      };
      await db
        .update(organization)
        .set({
          metadata: serializeOrganizationSettingsMetadata(
            settings as Parameters<
              typeof serializeOrganizationSettingsMetadata
            >[0]
          ),
        })
        .where(eq(organization.id, organizationId));

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
      expect(accountRows[0].interestRate).toBe(3);

      await cleanup();
    });
  });

  describe("VAL-SALE-011: credit reversal guards against inconsistent balances", () => {
    test("cancellation is rejected when the account balance no longer covers the charge", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, customerId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 30_000,
          stock: 10,
          trackInventory: true,
        }),
        seedCustomer(db, {
          organizationId,
          name: "Eva",
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 30_000 }],
          payments: [],
          isCreditSale: true,
        },
        { db, organizationId, userId }
      );

      // Simulate external drift: the balance no longer covers the charge.
      await db
        .update(creditAccount)
        .set({ balance: 10_000 })
        .where(
          and(
            eq(creditAccount.organizationId, organizationId),
            eq(creditAccount.customerId, customerId)
          )
        );

      // try/catch instead of expect().rejects: bun test on Windows deadlocks
      // when a transaction promise is passed to expect().rejects.
      let cancelRejectionMessage = "";
      try {
        await cancelSaleViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { saleId: saleResult.saleId },
        });
      } catch (error) {
        cancelRejectionMessage = (error as Error).message;
      }
      expect(cancelRejectionMessage).toBe(
        "La cuenta de crédito ya no coincide con la deuda de esta venta"
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
      expect(accountRows[0].balance).toBe(10_000);

      await cleanup();
    });
  });

  describe("VAL-SALE-009b: cash overpayment split rules", () => {
    test("split payment with non-cash exactly at total and cash covering change is allowed", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [
            { method: "card", amount: 6000 },
            { method: "cash", amount: 8000 },
          ],
        },
        { db, organizationId, userId }
      );

      expect(result.totalAmount).toBe(10_000);
      expect(result.paidAmount).toBe(10_000);

      await cleanup();
    });
  });

  describe("VAL-SALE-TAX: tax calculations in sale creation", () => {
    test("sale with 19% tax product persists tax in sale and saleItem", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Taxed Item",
          price: 10_000,
          taxRate: 19,
          stock: 10,
          trackInventory: true,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 2, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 23_800 }],
        },
        { db, organizationId, userId }
      );

      expect(result.taxAmount).toBe(3800);
      expect(result.totalAmount).toBe(23_800);

      const [saleRow] = await db
        .select()
        .from(sale)
        .where(eq(sale.id, result.saleId));
      expect(saleRow?.taxAmount).toBe(3800);

      const items = await db
        .select()
        .from(saleItem)
        .where(eq(saleItem.saleId, result.saleId));
      expect(items[0]?.taxRate).toBe(19);
      expect(items[0]?.taxAmount).toBe(3800);

      await cleanup();
    });

    test("sale with mixed tax rates aggregates correctly", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [prod1, prod2, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Taxed",
          price: 10_000,
          taxRate: 19,
          stock: 10,
        }),
        seedProduct(db, {
          organizationId,
          name: "Exempt",
          price: 5000,
          taxRate: 0,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [
            { productId: prod1, quantity: 1, unitPrice: 10_000 },
            { productId: prod2, quantity: 2, unitPrice: 5000 },
          ],
          payments: [{ method: "cash", amount: 21_900 }],
        },
        { db, organizationId, userId }
      );

      expect(result.subtotal).toBe(20_000);
      expect(result.taxAmount).toBe(1900);
      expect(result.totalAmount).toBe(21_900);

      await cleanup();
    });

    test("tax rate override on item is frozen in saleItem", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Override Tax",
          price: 10_000,
          taxRate: 19,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000, taxRate: 5 }],
          payments: [{ method: "cash", amount: 10_500 }],
        },
        { db, organizationId, userId }
      );

      expect(result.taxAmount).toBe(500);

      const items = await db
        .select()
        .from(saleItem)
        .where(eq(saleItem.saleId, result.saleId));
      expect(items[0]?.taxRate).toBe(5);
      expect(items[0]?.taxAmount).toBe(500);

      await cleanup();
    });
  });

  describe("VAL-SALE-DISC: discount calculations in sale creation", () => {
    test("item-level discount persists in saleItem and sale", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Discounted",
          price: 10_000,
          taxRate: 0,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [
            { productId, quantity: 1, unitPrice: 10_000, discountAmount: 2000 },
          ],
          payments: [{ method: "cash", amount: 8000 }],
        },
        { db, organizationId, userId }
      );

      expect(result.discountAmount).toBe(2000);
      expect(result.totalAmount).toBe(8000);

      const items = await db
        .select()
        .from(saleItem)
        .where(eq(saleItem.saleId, result.saleId));
      expect(items[0]?.discountAmount).toBe(2000);

      await cleanup();
    });

    test("sale-level discount persists in sale total", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Sale Discount",
          price: 10_000,
          taxRate: 0,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 2, unitPrice: 10_000 }],
          discountAmount: 5000,
          payments: [{ method: "cash", amount: 15_000 }],
        },
        { db, organizationId, userId }
      );

      expect(result.discountAmount).toBe(5000);
      expect(result.totalAmount).toBe(15_000);

      const [saleRow] = await db
        .select()
        .from(sale)
        .where(eq(sale.id, result.saleId));
      expect(saleRow?.discountAmount).toBe(5000);

      await cleanup();
    });

    test("both item and sale-level discounts sum in sale", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Both Discounts",
          price: 10_000,
          taxRate: 0,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      const result = await createCoreSale(
        {
          shiftId,
          items: [
            { productId, quantity: 2, unitPrice: 10_000, discountAmount: 3000 },
          ],
          discountAmount: 2000,
          payments: [{ method: "cash", amount: 15_000 }],
        },
        { db, organizationId, userId }
      );

      expect(result.discountAmount).toBe(5000);
      expect(result.totalAmount).toBe(15_000);

      await cleanup();
    });

    test("sale-level discount exceeding total is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Over Discount",
          price: 10_000,
          taxRate: 0,
          stock: 10,
        }),
        seedShift(db, { organizationId, userId, status: "open" }),
      ]);

      await expect(
        createCoreSale(
          {
            shiftId,
            items: [{ productId, quantity: 1, unitPrice: 10_000 }],
            discountAmount: 15_000,
            payments: [{ method: "cash", amount: 5000 }],
          },
          { db, organizationId, userId }
        )
      ).rejects.toThrow("no puede ser negativo");

      await cleanup();
    });
  });
});
