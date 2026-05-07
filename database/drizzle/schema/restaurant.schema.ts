import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth.schema";
import { product } from "./inventory.schema";
import { sale } from "./sales.schema";

export const restaurantArea = sqliteTable(
	"restaurant_area",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("restaurantArea_organizationId_idx").on(table.organizationId),
		uniqueIndex("restaurantArea_org_name_uidx").on(
			table.organizationId,
			table.name,
		),
	],
);

export const restaurantTable = sqliteTable(
	"restaurant_table",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		areaId: text("area_id")
			.notNull()
			.references(() => restaurantArea.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		seats: integer("seats").default(0).notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("restaurantTable_organizationId_idx").on(table.organizationId),
		index("restaurantTable_areaId_idx").on(table.areaId),
		uniqueIndex("restaurantTable_org_area_name_uidx").on(
			table.organizationId,
			table.areaId,
			table.name,
		),
	],
);

export const restaurantOrder = sqliteTable(
	"restaurant_order",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		tableId: text("table_id")
			.notNull()
			.references(() => restaurantTable.id, { onDelete: "restrict" }),
		openedByUserId: text("opened_by_user_id")
			.notNull()
			.references(() => user.id),
		closedByUserId: text("closed_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		saleId: text("sale_id").references(() => sale.id, { onDelete: "set null" }),
		orderNumber: integer("order_number").notNull(),
		status: text("status").notNull().default("open"),
		guestCount: integer("guest_count").default(0).notNull(),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		closedAt: integer("closed_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("restaurantOrder_organizationId_idx").on(table.organizationId),
		index("restaurantOrder_tableId_idx").on(table.tableId),
		uniqueIndex("restaurantOrder_org_number_uidx").on(
			table.organizationId,
			table.orderNumber,
		),
		uniqueIndex("restaurantOrder_saleId_uidx").on(table.saleId),
	],
);

export const restaurantKitchenTicket = sqliteTable(
	"restaurant_kitchen_ticket",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		orderId: text("order_id")
			.notNull()
			.references(() => restaurantOrder.id, { onDelete: "cascade" }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id),
		sequenceNumber: integer("sequence_number").notNull(),
		status: text("status").notNull().default("sent"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		printedAt: integer("printed_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("restaurantKitchenTicket_organizationId_idx").on(
			table.organizationId,
		),
		index("restaurantKitchenTicket_orderId_idx").on(table.orderId),
		uniqueIndex("restaurantKitchenTicket_order_sequence_uidx").on(
			table.orderId,
			table.sequenceNumber,
		),
	],
);

export const restaurantOrderItem = sqliteTable(
	"restaurant_order_item",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		orderId: text("order_id")
			.notNull()
			.references(() => restaurantOrder.id, { onDelete: "cascade" }),
		kitchenTicketId: text("kitchen_ticket_id").references(
			() => restaurantKitchenTicket.id,
			{
				onDelete: "set null",
			},
		),
		productId: text("product_id")
			.notNull()
			.references(() => product.id),
		quantity: integer("quantity").notNull(),
		unitPrice: integer("unit_price").notNull(),
		taxRate: integer("tax_rate").default(0).notNull(),
		discountAmount: integer("discount_amount").default(0).notNull(),
		notes: text("notes"),
		status: text("status").notNull().default("draft"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => new Date())
			.notNull(),
		sentAt: integer("sent_at", { mode: "timestamp_ms" }),
		readyAt: integer("ready_at", { mode: "timestamp_ms" }),
		servedAt: integer("served_at", { mode: "timestamp_ms" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("restaurantOrderItem_organizationId_idx").on(table.organizationId),
		index("restaurantOrderItem_orderId_idx").on(table.orderId),
		index("restaurantOrderItem_ticketId_idx").on(table.kitchenTicketId),
	],
);

export const restaurantOrderItemModifier = sqliteTable(
	"restaurant_order_item_modifier",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		orderItemId: text("order_item_id")
			.notNull()
			.references(() => restaurantOrderItem.id, { onDelete: "cascade" }),
		modifierProductId: text("modifier_product_id")
			.notNull()
			.references(() => product.id),
		quantity: integer("quantity").notNull(),
		unitPrice: integer("unit_price").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("restaurantOrderItemModifier_organizationId_idx").on(
			table.organizationId,
		),
		index("restaurantOrderItemModifier_orderItemId_idx").on(table.orderItemId),
	],
);
