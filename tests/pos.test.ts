import { describe, expect, test } from "bun:test";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { eq } from "drizzle-orm";
import { product } from "@/database/drizzle/schema/inventory.schema";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import { schema as zeroSchema } from "@/zero/schema";
import {
  seedCategory,
  seedCustomer,
  seedOrganizationWithMember,
  seedProduct,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import {
  getActiveShiftViaZero,
  listPosCategoriesViaZero,
  listPosModifiersViaZero,
  searchPosProductsViaZero,
} from "./helpers/zero-pos";
import { createSaleViaZero, getSaleDetailViaZero } from "./helpers/zero-sales";
import {
  createZeroContext,
  createZeroTestDb,
  getShiftCloseSummaryViaZero,
  openShiftViaZero,
  registerCashMovementViaZero,
} from "./helpers/zero-shifts";

describe("POS checkout", () => {
  describe("VAL-POS-001: shift open prevents duplicate for same user", () => {
    test("opening a second shift for same user is rejected", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      // Open first shift
      const first = await openShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { startingCash: 5000 },
      });
      expect(first.status).toBe("open");

      // Try open second shift for same user
      await expect(
        openShiftViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { startingCash: 3000 },
        })
      ).rejects.toThrow("El usuario ya tiene un turno abierto");

      await cleanup();
    });
  });

  describe("VAL-POS-002: shift close computes expected amounts correctly including cash change", () => {
    test("close summary expected cash accounts for cash change given", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      // Open shift with starting cash
      const shiftOpen = await openShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { startingCash: 10_000 },
      });
      const shiftId = shiftOpen.id;

      // Seed product and create a sale with cash overpayment (change given)
      const productId = await seedProduct(db, {
        organizationId,
        name: "Widget",
        price: 15_000,
        stock: 10,
        trackInventory: true,
      });

      await createSaleViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 15_000 }],
          payments: [{ method: "cash", amount: 20_000 }],
        },
      });

      // Close summary: expected cash = startingCash + cashSales - change
      // = 10000 + 20000 - 5000 = 25000
      const summary = await getShiftCloseSummaryViaZero({
        zeroDb,
        ctx: zeroCtx,
        shiftId,
      });
      const cashSummary = summary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash"
      );
      expect(cashSummary).toBeDefined();
      expect(cashSummary?.expectedAmount).toBe(25_000);

      await cleanup();
    });
  });

  describe("VAL-POS-003: cash movements are included in shift close summary", () => {
    test("close summary reflects registered inflow, expense, and payout", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const shiftOpen = await openShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { startingCash: 5000 },
      });
      const shiftId = shiftOpen.id;

      // Register movements
      await registerCashMovementViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          type: "inflow",
          paymentMethod: "cash",
          amount: 3000,
          description: "Extra inflow",
        },
      });
      await registerCashMovementViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          type: "expense",
          paymentMethod: "cash",
          amount: 2000,
          description: "Office supplies",
        },
      });
      await registerCashMovementViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          type: "payout",
          paymentMethod: "cash",
          amount: 1000,
          description: "Payout to vendor",
        },
      });

      // Create a sale with card (so cash only has movements + starting cash)
      const productId = await seedProduct(db, {
        organizationId,
        name: "Service",
        price: 10_000,
        stock: 10,
        trackInventory: true,
      });
      await createSaleViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          items: [{ productId, quantity: 1, unitPrice: 10_000 }],
          payments: [{ method: "card", amount: 10_000 }],
        },
      });

      const summary = await getShiftCloseSummaryViaZero({
        zeroDb,
        ctx: zeroCtx,
        shiftId,
      });
      const cashSummary = summary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash"
      );
      // expected cash = startingCash 5000 + inflow 3000 - expense 2000 - payout 1000 = 5000
      expect(cashSummary?.expectedAmount).toBe(5000);

      // Verify movement totals in summary
      expect(summary.movements.totals.inflow).toBe(3000);
      expect(summary.movements.totals.expense).toBe(2000);
      expect(summary.movements.totals.payout).toBe(1000);
      expect(summary.movements.totals.net).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-POS-004: POS bootstrap returns active shift, categories, and modifier products only", () => {
    test("bootstrap payload contains active shift, categories, and modifier products", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      // Seed categories
      const [catA, catB] = await Promise.all([
        seedCategory(db, { organizationId, name: "Drinks" }),
        seedCategory(db, { organizationId, name: "Food" }),
      ]);

      // Seed modifier product
      const [modifierId] = await Promise.all([
        seedProduct(db, {
          organizationId,
          name: "Extra Cheese",
          price: 2000,
          isModifier: true,
          trackInventory: false,
          stock: 0,
        }),
        seedProduct(db, {
          organizationId,
          categoryId: catA,
          name: "Soda",
          price: 5000,
          isModifier: false,
          trackInventory: true,
          stock: 20,
        }),
      ]);

      // Open shift
      const shiftOpen = await openShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { startingCash: 0 },
      });
      expect(shiftOpen.id).toBeDefined();

      const [activeShift, categories, modifierProducts] = await Promise.all([
        getActiveShiftViaZero({ zeroDb, ctx: zeroCtx }),
        listPosCategoriesViaZero({ zeroDb, ctx: zeroCtx }),
        listPosModifiersViaZero({ zeroDb, ctx: zeroCtx }),
      ]);

      expect(activeShift).toBeDefined();
      expect(activeShift?.id).toBe(shiftOpen.id);
      expect(activeShift?.status).toBe("open");

      const categoryIds = categories.map((category) => category.id);
      expect(categoryIds).toContain(catA);
      expect(categoryIds).toContain(catB);

      const modifierIds = modifierProducts.map((product) => product.id);
      expect(modifierIds).toContain(modifierId);
      expect(modifierIds.length).toBe(1);

      await cleanup();
    });

    test("bootstrap returns null activeShift when no open shift", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const activeShift = await getActiveShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
      });
      expect(activeShift).toBeNull();

      await cleanup();
    });
  });

  describe("VAL-POS-005: product search paginates, filters by category, and prioritizes exact barcode match", () => {
    test("product search paginates with limit and cursor", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      // Seed 5 products
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          seedProduct(db, {
            organizationId,
            name: `Product ${i + 1}`,
            price: (i + 1) * 1000,
            trackInventory: true,
            stock: 10,
          })
        )
      );

      // Page 1: limit 2
      const page1 = await searchPosProductsViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { limit: 2, cursor: 0 },
      });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(2);

      // Page 2: cursor 2
      const page2 = await searchPosProductsViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { limit: 2, cursor: 2 },
      });
      expect(page2.data.length).toBe(2);
      expect(page2.hasMore).toBe(true);
      expect(page2.nextCursor).toBe(4);

      // Page 3: cursor 4
      const page3 = await searchPosProductsViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { limit: 2, cursor: 4 },
      });
      expect(page3.data.length).toBe(1);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeNull();

      await cleanup();
    });

    test("product search filters by category", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const [catA, catB] = await Promise.all([
        seedCategory(db, { organizationId, name: "CatA" }),
        seedCategory(db, { organizationId, name: "CatB" }),
      ]);

      const [prodA, prodB] = await Promise.all([
        seedProduct(db, {
          organizationId,
          categoryId: catA,
          name: "Alpha",
          price: 1000,
        }),
        seedProduct(db, {
          organizationId,
          categoryId: catB,
          name: "Beta",
          price: 2000,
        }),
      ]);
      expect(prodA).toBeDefined();
      expect(prodB).toBeDefined();

      const [resultA, resultB] = await Promise.all([
        searchPosProductsViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { categoryId: catA },
        }),
        searchPosProductsViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { categoryId: catB },
        }),
      ]);
      expect(resultA.data.length).toBe(1);
      expect(resultA.data[0].id).toBe(prodA);
      expect(resultB.data.length).toBe(1);
      expect(resultB.data[0].id).toBe(prodB);

      await cleanup();
    });

    test("product search prioritizes exact barcode match", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      await seedProduct(db, {
        organizationId,
        name: "Banana Barcode",
        barcode: "12345",
        price: 1000,
      });
      await seedProduct(db, {
        organizationId,
        name: "Another Product",
        barcode: "67890",
        price: 2000,
      });
      await seedProduct(db, {
        organizationId,
        name: "12345 SKU item",
        sku: "12345",
        barcode: "99999",
        price: 3000,
      });

      const result = await searchPosProductsViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { searchQuery: "12345" },
      });
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      // Exact barcode match should be first
      expect(result.data[0].barcode).toBe("12345");

      await cleanup();
    });
  });

  describe("VAL-POS-006: customer search excludes soft-deleted customers", () => {
    test("soft-deleted customer does not appear in search results", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = zeroDrizzle(zeroSchema, db);
      const zeroContext = createZeroContext(userId, organizationId);

      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Deleted Customer",
      });
      expect(customerId).toBeDefined();

      // Verify customer exists before deletion through the migrated Zero query.
      const before = await zeroDb.run(
        queries.customers.search.fn({
          args: { limit: 50, searchQuery: "Deleted" },
          ctx: zeroContext,
        })
      );
      expect(before.length).toBe(1);
      expect(before[0].id).toBe(customerId);

      // Soft-delete the customer through the migrated Zero mutator.
      await zeroDb.transaction((tx) =>
        serverMutators.customers.delete.fn({
          args: { id: customerId },
          ctx: zeroContext,
          tx,
        })
      );

      // Search should exclude soft-deleted rows.
      const after = await zeroDb.run(
        queries.customers.search.fn({
          args: { limit: 50, searchQuery: "Deleted" },
          ctx: zeroContext,
        })
      );
      expect(after.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-POS-007: sale creation through Zero sales.create with shift context works end-to-end", () => {
    test("POS end-to-end: open shift, search product, create sale, verify stock and shift link", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      // Bootstrap POS (open shift implicitly)
      const shiftOpen = await openShiftViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { startingCash: 10_000 },
      });
      const shiftId = shiftOpen.id;

      // Create category and product
      const categoryId = await seedCategory(db, {
        organizationId,
        name: "Beverages",
      });
      const productId = await seedProduct(db, {
        organizationId,
        categoryId,
        name: "Coffee",
        price: 8000,
        stock: 50,
        trackInventory: true,
      });

      // Verify product appears in search and check stock before
      const [searchResult, beforeStock] = await Promise.all([
        searchPosProductsViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { searchQuery: "Coffee" },
        }),
        db
          .select({ stock: product.stock })
          .from(product)
          .where(eq(product.id, productId)),
      ]);
      expect(searchResult.data.length).toBe(1);
      expect(searchResult.data[0].id).toBe(productId);
      expect(beforeStock[0].stock).toBe(50);

      // Create sale
      const saleResult = await createSaleViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          shiftId,
          items: [{ productId, quantity: 2, unitPrice: 8000 }],
          payments: [{ method: "cash", amount: 16_000 }],
        },
      });

      expect(saleResult.status).toBe("completed");
      expect(saleResult.totalAmount).toBe(16_000);
      expect(saleResult.paidAmount).toBe(16_000);
      expect(saleResult.balanceDue).toBe(0);

      // Verify stock decremented
      const afterStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterStock[0].stock).toBe(48);

      // Verify sale detail links to shift
      const detail = await getSaleDetailViaZero({
        zeroDb,
        ctx: zeroCtx,
        saleId: saleResult.saleId,
      });
      expect(detail).not.toBeNull();
      expect(detail?.shift?.id).toBe(shiftId);
      expect(detail?.items.length).toBe(1);
      expect(detail?.items[0].name).toBe("Coffee");
      expect(detail?.items[0].quantity).toBe(2);

      await cleanup();
    });
  });
});
