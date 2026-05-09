import { describe, test, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedCustomer,
  seedShift,
  seedCategory,
  makeUser,
} from "./helpers/seed";
import { buildMockContext } from "./helpers/orpc-context";
import { createServerORPCClient } from "../server/orpc/client/server";
import { product } from "../database/drizzle/schema/inventory.schema";
import { eq, and, isNull } from "drizzle-orm";

describe("POS checkout", () => {
  describe("VAL-POS-001: shift open prevents duplicate for same user", () => {
    test("opening a second shift for same user is rejected", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Open first shift
      const first = await client.shifts.open({ startingCash: 5000 });
      expect(first.status).toBe("open");

      // Try open second shift for same user
      await expect(
        client.shifts.open({ startingCash: 3000 }),
      ).rejects.toThrow("El usuario ya tiene un turno abierto");

      await cleanup();
    });
  });

  describe("VAL-POS-002: shift close computes expected amounts correctly including cash change", () => {
    test("close summary expected cash accounts for cash change given", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Open shift with starting cash
      const shiftOpen = await client.shifts.open({ startingCash: 10000 });
      const shiftId = shiftOpen.id;

      // Seed product and create a sale with cash overpayment (change given)
      const productId = await seedProduct(db, {
        organizationId,
        name: "Widget",
        price: 15000,
        stock: 10,
        trackInventory: true,
      });

      await client.sales.create({
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 15000 }],
        payments: [{ method: "cash", amount: 20000 }],
      });

      // Close summary: expected cash = startingCash + cashSales - change
      // = 10000 + 20000 - 5000 = 25000
      const summary = await client.shifts.closeSummary({ shiftId });
      const cashSummary = summary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash",
      );
      expect(cashSummary).toBeDefined();
      expect(cashSummary?.expectedAmount).toBe(25000);

      await cleanup();
    });
  });

  describe("VAL-POS-003: cash movements are included in shift close summary", () => {
    test("close summary reflects registered inflow, expense, and payout", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const shiftOpen = await client.shifts.open({ startingCash: 5000 });
      const shiftId = shiftOpen.id;

      // Register movements
      await client.shifts.cashMovement({
        shiftId,
        type: "inflow",
        paymentMethod: "cash",
        amount: 3000,
        description: "Extra inflow",
      });
      await client.shifts.cashMovement({
        shiftId,
        type: "expense",
        paymentMethod: "cash",
        amount: 2000,
        description: "Office supplies",
      });
      await client.shifts.cashMovement({
        shiftId,
        type: "payout",
        paymentMethod: "cash",
        amount: 1000,
        description: "Payout to vendor",
      });

      // Create a sale with card (so cash only has movements + starting cash)
      const productId = await seedProduct(db, {
        organizationId,
        name: "Service",
        price: 10000,
        stock: 10,
        trackInventory: true,
      });
      await client.sales.create({
        shiftId,
        items: [{ productId, quantity: 1, unitPrice: 10000 }],
        payments: [{ method: "card", amount: 10000 }],
      });

      const summary = await client.shifts.closeSummary({ shiftId });
      const cashSummary = summary.summaryByMethod.find(
        (s: { paymentMethod: string }) => s.paymentMethod === "cash",
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
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Seed categories
      const catA = await seedCategory(db, { organizationId, name: "Drinks" });
      const catB = await seedCategory(db, { organizationId, name: "Food" });

      // Seed modifier product
      const modifierId = await seedProduct(db, {
        organizationId,
        name: "Extra Cheese",
        price: 2000,
        isModifier: true,
        trackInventory: false,
        stock: 0,
      });

      // Seed regular product (should not appear in modifierProducts)
      await seedProduct(db, {
        organizationId,
        categoryId: catA,
        name: "Soda",
        price: 5000,
        isModifier: false,
        trackInventory: true,
        stock: 20,
      });

      // Open shift
      const shiftOpen = await client.shifts.open({ startingCash: 0 });

      const bootstrap = await client.pos.bootstrap();

      expect(bootstrap.activeShift).toBeDefined();
      expect(bootstrap.activeShift?.id).toBe(shiftOpen.id);
      expect(bootstrap.activeShift?.status).toBe("open");

      const categoryIds = bootstrap.categories.map((c: { id: string }) => c.id);
      expect(categoryIds).toContain(catA);
      expect(categoryIds).toContain(catB);

      const modifierIds = bootstrap.modifierProducts.map(
        (p: { id: string }) => p.id,
      );
      expect(modifierIds).toContain(modifierId);
      expect(modifierIds.length).toBe(1);

      await cleanup();
    });

    test("bootstrap returns null activeShift when no open shift", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const bootstrap = await client.pos.bootstrap();
      expect(bootstrap.activeShift).toBeNull();

      await cleanup();
    });
  });

  describe("VAL-POS-005: product search paginates, filters by category, and prioritizes exact barcode match", () => {
    test("product search paginates with limit and cursor", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Seed 5 products
      for (let i = 1; i <= 5; i++) {
        await seedProduct(db, {
          organizationId,
          name: `Product ${i}`,
          price: i * 1000,
          trackInventory: true,
          stock: 10,
        });
      }

      // Page 1: limit 2
      const page1 = await client.pos.searchProducts({ limit: 2, cursor: 0 });
      expect(page1.data.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(2);

      // Page 2: cursor 2
      const page2 = await client.pos.searchProducts({ limit: 2, cursor: 2 });
      expect(page2.data.length).toBe(2);
      expect(page2.hasMore).toBe(true);
      expect(page2.nextCursor).toBe(4);

      // Page 3: cursor 4
      const page3 = await client.pos.searchProducts({ limit: 2, cursor: 4 });
      expect(page3.data.length).toBe(1);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeNull();

      await cleanup();
    });

    test("product search filters by category", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const catA = await seedCategory(db, { organizationId, name: "CatA" });
      const catB = await seedCategory(db, { organizationId, name: "CatB" });

      const prodA = await seedProduct(db, {
        organizationId,
        categoryId: catA,
        name: "Alpha",
        price: 1000,
      });
      const prodB = await seedProduct(db, {
        organizationId,
        categoryId: catB,
        name: "Beta",
        price: 2000,
      });

      const resultA = await client.pos.searchProducts({ categoryId: catA });
      expect(resultA.data.length).toBe(1);
      expect(resultA.data[0].id).toBe(prodA);

      const resultB = await client.pos.searchProducts({ categoryId: catB });
      expect(resultB.data.length).toBe(1);
      expect(resultB.data[0].id).toBe(prodB);

      await cleanup();
    });

    test("product search prioritizes exact barcode match", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

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

      const result = await client.pos.searchProducts({ searchQuery: "12345" });
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      // Exact barcode match should be first
      expect(result.data[0].barcode).toBe("12345");

      await cleanup();
    });
  });

  describe("VAL-POS-006: customer search excludes soft-deleted customers", () => {
    test("soft-deleted customer does not appear in search results", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const customerId = await seedCustomer(db, {
        organizationId,
        name: "Deleted Customer",
      });

      // Verify customer exists before deletion
      const before = await client.customers.search({ searchQuery: "Deleted" });
      expect(before.data.length).toBe(1);
      expect(before.data[0].id).toBe(customerId);

      // Soft-delete the customer via direct DB update (customers.delete endpoint)
      await client.customers.delete({ id: customerId });

      // Search should exclude soft-deleted
      const after = await client.customers.search({ searchQuery: "Deleted" });
      expect(after.data.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-POS-007: sale creation through sales.create with shift context works end-to-end", () => {
    test("POS end-to-end: open shift, search product, create sale, verify stock and shift link", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const u = makeUser({ id: userId });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Bootstrap POS (open shift implicitly)
      const shiftOpen = await client.shifts.open({ startingCash: 10000 });
      const shiftId = shiftOpen.id;

      // Create category and product
      const categoryId = await seedCategory(db, { organizationId, name: "Beverages" });
      const productId = await seedProduct(db, {
        organizationId,
        categoryId,
        name: "Coffee",
        price: 8000,
        stock: 50,
        trackInventory: true,
      });

      // Verify product appears in search
      const searchResult = await client.pos.searchProducts({ searchQuery: "Coffee" });
      expect(searchResult.data.length).toBe(1);
      expect(searchResult.data[0].id).toBe(productId);

      // Check stock before
      const beforeStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(beforeStock[0].stock).toBe(50);

      // Create sale
      const saleResult = await client.sales.create({
        shiftId,
        items: [{ productId, quantity: 2, unitPrice: 8000 }],
        payments: [{ method: "cash", amount: 16000 }],
      });

      expect(saleResult.status).toBe("completed");
      expect(saleResult.totalAmount).toBe(16000);
      expect(saleResult.paidAmount).toBe(16000);
      expect(saleResult.balanceDue).toBe(0);

      // Verify stock decremented
      const afterStock = await db
        .select({ stock: product.stock })
        .from(product)
        .where(eq(product.id, productId));
      expect(afterStock[0].stock).toBe(48);

      // Verify sale detail links to shift
      const detail = await client.sales.detail({ saleId: saleResult.saleId });
      expect(detail).not.toBeNull();
      expect(detail?.shift?.id).toBe(shiftId);
      expect(detail?.items.length).toBe(1);
      expect(detail?.items[0].name).toBe("Coffee");
      expect(detail?.items[0].quantity).toBe(2);

      await cleanup();
    });
  });
});
