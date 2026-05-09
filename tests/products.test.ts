import { describe, test, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";
import {
	seedOrganizationWithMember,
	seedCategory,
	seedProduct,
	makeUser,
} from "./helpers/seed";
import { buildMockContext } from "./helpers/orpc-context";
import { createServerORPCClient } from "../server/orpc/client/server";
import {
	category,
	product,
} from "../database/drizzle/schema/inventory.schema";
import { eq, and } from "drizzle-orm";

describe("product CRUD", () => {
	describe("VAL-PROD-001: category creation normalizes name and description", () => {
		test("creates categories with normalized values", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.products.createCategory({
				name: "  Beverages  ",
				description: "  ",
			});
			expect(result.id).toBeString();

			const rows = await db
				.select()
				.from(category)
				.where(eq(category.id, result.id));
			expect(rows.length).toBe(1);
			expect(rows[0].name).toBe("Beverages");
			expect(rows[0].description).toBeNull();

			await cleanup();
		});
	});

	describe("VAL-PROD-002: product creation succeeds with valid data and is org-scoped", () => {
		test("creates a product scoped to active organization", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const categoryId = await seedCategory(db, {
				organizationId,
				name: "Food",
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			const result = await client.products.create({
				name: "Burger",
				categoryId,
				sku: "BUR-001",
				barcode: "123456789",
				price: 15000,
				cost: 5000,
				taxRate: 0,
				stock: 50,
				trackInventory: true,
				isModifier: false,
			});
			expect(result.id).toBeString();

			const rows = await db
				.select()
				.from(product)
				.where(eq(product.id, result.id));
			expect(rows.length).toBe(1);
			expect(rows[0].organizationId).toBe(organizationId);
			expect(rows[0].name).toBe("Burger");
			expect(rows[0].sku).toBe("BUR-001");
			expect(rows[0].barcode).toBe("123456789");
			expect(rows[0].price).toBe(15000);
			expect(rows[0].cost).toBe(5000);
			expect(rows[0].stock).toBe(50);

			await cleanup();
		});
	});

	describe("VAL-PROD-009: product creation rejects external-org category", () => {
		test("rejects product creation with category from another organization", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const { organizationId: otherOrgId } = await seedOrganizationWithMember(
				db,
				{ orgName: "Other Org" },
			);
			const externalCategoryId = await seedCategory(db, {
				organizationId: otherOrgId,
				name: "External Category",
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			await expect(
				client.products.create({
					name: "Invalid Product",
					categoryId: externalCategoryId,
					price: 10000,
				}),
			).rejects.toThrow("La categoría seleccionada no existe en la organización actual");

			await cleanup();
		});
	});

	describe("VAL-PROD-003: soft-deleted products are excluded from list but can be recreated with same barcode/sku", () => {
		test("soft-deleted product excluded from list and barcode/sku can be reused", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const categoryId = await seedCategory(db, {
				organizationId,
				name: "Drinks",
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			// Create product
			const createResult = await client.products.create({
				name: "Soda",
				categoryId,
				sku: "SODA-001",
				barcode: "987654321",
				price: 5000,
				stock: 100,
			});

			// Product appears in list
			const listBefore = await client.products.list();
			expect(listBefore.some((p) => p.id === createResult.id)).toBe(true);

			// Soft delete
			await client.products.delete({ id: createResult.id });

			// Deleted product excluded from list
			const listAfter = await client.products.list();
			expect(listAfter.some((p) => p.id === createResult.id)).toBe(false);

			// Reuse barcode and sku
			const reuseResult = await client.products.create({
				name: "Soda v2",
				categoryId,
				sku: "SODA-001",
				barcode: "987654321",
				price: 5500,
				stock: 200,
			});
			expect(reuseResult.id).toBeString();
			expect(reuseResult.id).not.toBe(createResult.id);

			await cleanup();
		});
	});

	describe("VAL-PROD-004: product update applies normalization and category validation", () => {
		test("update normalizes name and rejects external category", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const categoryId = await seedCategory(db, {
				organizationId,
				name: "Snacks",
			});
			const productId = await seedProduct(db, {
				organizationId,
				categoryId,
				name: "Chips",
				price: 3000,
			});
			const { organizationId: otherOrgId } = await seedOrganizationWithMember(
				db,
				{ orgName: "Other Org" },
			);
			const externalCategoryId = await seedCategory(db, {
				organizationId: otherOrgId,
				name: "External",
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			// Normalization test
			await client.products.update({
				id: productId,
				name: "  Premium Chips  ",
			});
			const rows = await db
				.select()
				.from(product)
				.where(eq(product.id, productId));
			expect(rows[0].name).toBe("Premium Chips");

			// External category rejection
			await expect(
				client.products.update({
					id: productId,
					categoryId: externalCategoryId,
				}),
			).rejects.toThrow("La categoría seleccionada no existe en la organización actual");

			await cleanup();
		});
	});

	describe("VAL-PROD-005: inventory movement registration updates stock correctly", () => {
		test("restock adds stock and waste subtracts stock", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const productId = await seedProduct(db, {
				organizationId,
				name: "Coffee Beans",
				price: 20000,
				stock: 100,
				trackInventory: true,
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			// Restock adds 50
			await client.products.registerInventoryMovement({
				productId,
				type: "restock",
				quantity: 50,
				notes: "New shipment",
			});
			const afterRestock = await db
				.select({ stock: product.stock })
				.from(product)
				.where(eq(product.id, productId));
			expect(afterRestock[0].stock).toBe(150);

			// Waste subtracts 20
			await client.products.registerInventoryMovement({
				productId,
				type: "waste",
				quantity: 20,
				notes: "Expired batch",
			});
			const afterWaste = await db
				.select({ stock: product.stock })
				.from(product)
				.where(eq(product.id, productId));
			expect(afterWaste[0].stock).toBe(130);

			await cleanup();
		});
	});

	describe("VAL-PROD-006: restock with set_as_total on negative stock uses final total", () => {
		test("set_as_total on negative stock sets final total correctly", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const productId = await seedProduct(db, {
				organizationId,
				name: "Tea",
				price: 8000,
				stock: -10,
				trackInventory: true,
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			await client.products.registerInventoryMovement({
				productId,
				type: "restock",
				quantity: 25,
				restockMode: "set_as_total",
				notes: "Inventory count",
			});

			const rows = await db
				.select({ stock: product.stock })
				.from(product)
				.where(eq(product.id, productId));
			expect(rows[0].stock).toBe(25);

			await cleanup();
		});
	});

	describe("VAL-PROD-007: isModifier flag persists on create and update", () => {
		test("isModifier persists through create and update", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const categoryId = await seedCategory(db, {
				organizationId,
				name: "Extras",
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			// Create with isModifier=true
			const createResult = await client.products.create({
				name: "Extra Cheese",
				categoryId,
				price: 2000,
				isModifier: true,
			});

			const afterCreate = await db
				.select({ isModifier: product.isModifier })
				.from(product)
				.where(eq(product.id, createResult.id));
			expect(afterCreate[0].isModifier).toBe(true);

			// Update to false
			await client.products.update({
				id: createResult.id,
				isModifier: false,
			});
			const afterUpdate = await db
				.select({ isModifier: product.isModifier })
				.from(product)
				.where(eq(product.id, createResult.id));
			expect(afterUpdate[0].isModifier).toBe(false);

			await cleanup();
		});
	});

	describe("VAL-PROD-008: empty update mutations are rejected", () => {
		test("product update with no fields is rejected", async () => {
			const { db, cleanup } = createTestDb();
			const { organizationId, userId } = await seedOrganizationWithMember(db);
			const categoryId = await seedCategory(db, {
				organizationId,
				name: "Misc",
			});
			const productId = await seedProduct(db, {
				organizationId,
				categoryId,
				name: "Widget",
				price: 1000,
			});

			const u = makeUser({ id: userId });
			const ctx = buildMockContext(db, u, organizationId);
			const client = createServerORPCClient(ctx);

			await expect(
				client.products.update({
					id: productId,
				}),
			).rejects.toThrow("Input validation failed");

			await cleanup();
		});
	});
});
