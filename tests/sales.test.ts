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
import { payment } from "@/database/drizzle/schema/sales.schema";
import { serializeOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { createServerORPCClient } from "@/server/orpc/client/server";
import { createCoreSale } from "@/server/sales/create-sale.server";
import { buildMockContext } from "./helpers/orpc-context";
import {
  makeUser,
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("sale creation transactions", () => {
  describe("VAL-SALE-001: createCoreSale decrements stock for tracked products", () => {
    test("stock is reduced by sold quantity after sale", async () => {
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
  });

  describe("VAL-SALE-002: sale creation validates payment totals", () => {
    test("payment records created and sum equals sale total", async () => {
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const [productId, shiftId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Item",
          price: 10_000,
          stock: 20,
          trackInventory: true,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const saleResult = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 5, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 50_000 }],
        },
        { db, organizationId, userId }
      );
      expect(saleResult.saleId).toBeDefined();

      const afterSale = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterSale[0].stock).toBe(15);

      await client.sales.cancel({ saleId: saleResult.saleId });

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
      const { db, cleanup } = createTestDb();
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
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const saleResult = await createCoreSale(
        {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [{ method: "cash", amount: 10_000 }],
        },
        { db, organizationId, userId }
      );

      await client.sales.cancel({ saleId: saleResult.saleId });
      await expect(
        client.sales.cancel({ saleId: saleResult.saleId })
      ).rejects.toThrow("La venta ya está anulada");

      await cleanup();
    });
  });

  describe("VAL-SALE-005: sale cancellation reverts credit balance", () => {
    test("credit sale cancellation reduces credit account balance", async () => {
      const { db, cleanup } = createTestDb();
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
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const saleResult = await createCoreSale(
        {
          shiftId,
          customerId,
          items: [{ productId, quantity: 1, unitPrice: 30_000 }],
          payments: [{ method: "cash", amount: 5000 }],
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
      expect(accountBefore[0].balance).toBe(25_000);

      await client.sales.cancel({ saleId: saleResult.saleId });

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

      await cleanup();
    });
  });

  describe("VAL-SALE-006: closed shift rejects new sales", () => {
    test("sale creation on closed shift is rejected", async () => {
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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
          metadata: serializeOrganizationSettingsMetadata(settings as any),
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
      const { db, cleanup } = createTestDb();
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
      expect(result.paidAmount).toBe(12_000);

      await cleanup();
    });

    test("overpayment with non-cash exceeding total is rejected", async () => {
      const { db, cleanup } = createTestDb();
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
      const { db, cleanup } = createTestDb();
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

    test("split payment with non-cash exactly at total and cash covering change is allowed", async () => {
      const { db, cleanup } = createTestDb();
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
      expect(result.paidAmount).toBe(14_000);

      await cleanup();
    });
  });
});
