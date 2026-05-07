import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth.schema";
import { saleItem, saleItemModifier } from "./sales.schema";

export const category = sqliteTable(
	"category",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("category_organizationId_idx").on(table.organizationId)],
);

export const product = sqliteTable(
	"product",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		sku: text("sku"),
		barcode: text("barcode"),
		price: integer("price").notNull(), // Precio en COP (entero)
		cost: integer("cost").default(0),
		taxRate: integer("tax_rate").default(0).notNull(), // % de impuesto (ej: 19 para IVA 19%, 0 para excluido)
		isModifier: integer("is_modifier", { mode: "boolean" })
			.default(false)
			.notNull(), // True para adiciones (ej: extra queso)
		trackInventory: integer("track_inventory", { mode: "boolean" })
			.default(true)
			.notNull(),
		stock: integer("stock").default(0).notNull(), // Cache del stock actual
		isFavorite: integer("is_favorite", { mode: "boolean" })
			.default(false)
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }), // Soft delete: null = activo, fecha = eliminado
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("product_organizationId_idx").on(table.organizationId),
		index("product_categoryId_idx").on(table.categoryId),
		uniqueIndex("product_org_barcode_uidx")
			.on(table.organizationId, table.barcode)
			.where(sql`deleted_at is null`),
		uniqueIndex("product_org_sku_uidx")
			.on(table.organizationId, table.sku)
			.where(sql`deleted_at is null`),
	],
);

export const inventoryMovement = sqliteTable(
	"inventory_movement",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		productId: text("product_id")
			.notNull()
			.references(() => product.id), // Sin cascade: proteger historial de movimientos
		userId: text("user_id").references(() => user.id), // Quién hizo el movimiento
		type: text("type").notNull(), // 'sale', 'restock', 'waste' (descarte), 'adjustment'
		quantity: integer("quantity").notNull(), // Positivo (ingreso) o Negativo (salida)
		notes: text("notes"), // Ej: "Tomate dañado"
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("inv_mov_productId_idx").on(table.productId)],
);

export const categoryRelations = relations(category, ({ one, many }) => ({
	organization: one(organization, {
		fields: [category.organizationId],
		references: [organization.id],
	}),
	products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
	organization: one(organization, {
		fields: [product.organizationId],
		references: [organization.id],
	}),
	category: one(category, {
		fields: [product.categoryId],
		references: [category.id],
	}),
	inventoryMovements: many(inventoryMovement),
	saleItems: many(saleItem),
	modifierItems: many(saleItemModifier),
}));

export const inventoryMovementRelations = relations(
	inventoryMovement,
	({ one }) => ({
		organization: one(organization, {
			fields: [inventoryMovement.organizationId],
			references: [organization.id],
		}),
		product: one(product, {
			fields: [inventoryMovement.productId],
			references: [product.id],
		}),
		user: one(user, {
			fields: [inventoryMovement.userId],
			references: [user.id],
		}),
	}),
);
