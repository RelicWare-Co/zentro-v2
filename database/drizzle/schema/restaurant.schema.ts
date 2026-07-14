import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";
import { product } from "./inventory.schema";
import { sale } from "./sales.schema";

export const restaurantArea = pgTable(
  "restaurant_area",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("restaurantArea_org_name_uidx")
      .on(table.organizationId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ]
);

export const restaurantTable = pgTable(
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
    isActive: boolean("is_active").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("restaurantTable_areaId_idx").on(table.areaId),
    uniqueIndex("restaurantTable_org_area_name_uidx")
      .on(table.organizationId, table.areaId, table.name)
      .where(sql`${table.deletedAt} is null`),
  ]
);

export const restaurantOrder = pgTable(
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
    cancelledByUserId: text("cancelled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    saleId: text("sale_id").references(() => sale.id, { onDelete: "set null" }),
    orderNumber: integer("order_number").notNull(),
    status: text("status").notNull().default("open"),
    guestCount: integer("guest_count").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    index("restaurantOrder_tableId_idx").on(table.tableId),
    uniqueIndex("restaurantOrder_org_number_uidx").on(
      table.organizationId,
      table.orderNumber
    ),
    uniqueIndex("restaurantOrder_saleId_uidx").on(table.saleId),
  ]
);

export const restaurantKitchenTicket = pgTable(
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
    kind: text("kind").notNull().default("initial"),
    sequenceNumber: integer("sequence_number").notNull(),
    status: text("status").notNull().default("sent"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    printedAt: timestamp("printed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("restaurantKitchenTicket_organizationId_idx").on(
      table.organizationId
    ),
    uniqueIndex("restaurantKitchenTicket_order_sequence_uidx").on(
      table.orderId,
      table.sequenceNumber
    ),
  ]
);

export const restaurantOrderItem = pgTable(
  "restaurant_order_item",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => restaurantOrder.id, { onDelete: "cascade" }),
    kitchenTicketId: text("kitchen_ticket_id"),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxRate: integer("tax_rate").default(0).notNull(),
    discountAmount: integer("discount_amount").default(0).notNull(),
    accountingTreatment: text("accounting_treatment")
      .notNull()
      .default("revenue"),
    notes: text("notes"),
    pendingCancellation: boolean("pending_cancellation")
      .notNull()
      .default(false),
    sentModifiersSnapshot: text("sent_modifiers_snapshot")
      .notNull()
      .default("[]"),
    sentNotes: text("sent_notes"),
    sentProductName: text("sent_product_name"),
    sentQuantity: integer("sent_quantity").notNull().default(0),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    readyAt: timestamp("ready_at", { withTimezone: true, mode: "date" }),
    servedAt: timestamp("served_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    foreignKey({
      name: "roi_kitchen_ticket_fk",
      columns: [table.kitchenTicketId],
      foreignColumns: [restaurantKitchenTicket.id],
    }).onDelete("set null"),
    index("restaurantOrderItem_organizationId_idx").on(table.organizationId),
    index("restaurantOrderItem_orderId_idx").on(table.orderId),
    index("restaurantOrderItem_ticketId_idx").on(table.kitchenTicketId),
  ]
);

export const restaurantKitchenTicketLine = pgTable(
  "restaurant_kitchen_ticket_line",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    kitchenTicketId: text("kitchen_ticket_id").notNull(),
    orderItemId: text("order_item_id").notNull(),
    operation: text("operation").notNull(),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    notes: text("notes"),
    modifiersSnapshot: text("modifiers_snapshot").notNull().default("[]"),
    status: text("status").notNull().default("sent"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "rktl_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organization.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "rktl_ticket_fk",
      columns: [table.kitchenTicketId],
      foreignColumns: [restaurantKitchenTicket.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "rktl_order_item_fk",
      columns: [table.orderItemId],
      foreignColumns: [restaurantOrderItem.id],
    }).onDelete("cascade"),
    index("restaurantKitchenTicketLine_ticketId_idx").on(table.kitchenTicketId),
    index("restaurantKitchenTicketLine_itemId_idx").on(table.orderItemId),
    index("restaurantKitchenTicketLine_organizationId_idx").on(
      table.organizationId
    ),
  ]
);

export const restaurantOrderItemModifier = pgTable(
  "restaurant_order_item_modifier",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    orderItemId: text("order_item_id").notNull(),
    modifierProductId: text("modifier_product_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "roim_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organization.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "roim_order_item_fk",
      columns: [table.orderItemId],
      foreignColumns: [restaurantOrderItem.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "roim_product_fk",
      columns: [table.modifierProductId],
      foreignColumns: [product.id],
    }),
    index("restaurantOrderItemModifier_organizationId_idx").on(
      table.organizationId
    ),
    index("restaurantOrderItemModifier_orderItemId_idx").on(table.orderItemId),
  ]
);

export const restaurantAreaRelations = relations(
  restaurantArea,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [restaurantArea.organizationId],
      references: [organization.id],
    }),
    tables: many(restaurantTable),
  })
);

export const restaurantTableRelations = relations(
  restaurantTable,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [restaurantTable.organizationId],
      references: [organization.id],
    }),
    area: one(restaurantArea, {
      fields: [restaurantTable.areaId],
      references: [restaurantArea.id],
    }),
    orders: many(restaurantOrder),
  })
);

export const restaurantOrderRelations = relations(
  restaurantOrder,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [restaurantOrder.organizationId],
      references: [organization.id],
    }),
    table: one(restaurantTable, {
      fields: [restaurantOrder.tableId],
      references: [restaurantTable.id],
    }),
    openedByUser: one(user, {
      fields: [restaurantOrder.openedByUserId],
      references: [user.id],
      relationName: "restaurantOrderOpenedBy",
    }),
    closedByUser: one(user, {
      fields: [restaurantOrder.closedByUserId],
      references: [user.id],
      relationName: "restaurantOrderClosedBy",
    }),
    cancelledByUser: one(user, {
      fields: [restaurantOrder.cancelledByUserId],
      references: [user.id],
      relationName: "restaurantOrderCancelledBy",
    }),
    sale: one(sale, {
      fields: [restaurantOrder.saleId],
      references: [sale.id],
    }),
    items: many(restaurantOrderItem),
    kitchenTickets: many(restaurantKitchenTicket),
  })
);

export const restaurantKitchenTicketRelations = relations(
  restaurantKitchenTicket,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [restaurantKitchenTicket.organizationId],
      references: [organization.id],
    }),
    order: one(restaurantOrder, {
      fields: [restaurantKitchenTicket.orderId],
      references: [restaurantOrder.id],
    }),
    createdByUser: one(user, {
      fields: [restaurantKitchenTicket.createdByUserId],
      references: [user.id],
    }),
    items: many(restaurantOrderItem),
    lines: many(restaurantKitchenTicketLine),
  })
);

export const restaurantOrderItemRelations = relations(
  restaurantOrderItem,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [restaurantOrderItem.organizationId],
      references: [organization.id],
    }),
    order: one(restaurantOrder, {
      fields: [restaurantOrderItem.orderId],
      references: [restaurantOrder.id],
    }),
    kitchenTicket: one(restaurantKitchenTicket, {
      fields: [restaurantOrderItem.kitchenTicketId],
      references: [restaurantKitchenTicket.id],
    }),
    product: one(product, {
      fields: [restaurantOrderItem.productId],
      references: [product.id],
    }),
    modifiers: many(restaurantOrderItemModifier),
    kitchenTicketLines: many(restaurantKitchenTicketLine),
  })
);

export const restaurantKitchenTicketLineRelations = relations(
  restaurantKitchenTicketLine,
  ({ one }) => ({
    kitchenTicket: one(restaurantKitchenTicket, {
      fields: [restaurantKitchenTicketLine.kitchenTicketId],
      references: [restaurantKitchenTicket.id],
    }),
    orderItem: one(restaurantOrderItem, {
      fields: [restaurantKitchenTicketLine.orderItemId],
      references: [restaurantOrderItem.id],
    }),
    organization: one(organization, {
      fields: [restaurantKitchenTicketLine.organizationId],
      references: [organization.id],
    }),
  })
);

export const restaurantOrderItemModifierRelations = relations(
  restaurantOrderItemModifier,
  ({ one }) => ({
    organization: one(organization, {
      fields: [restaurantOrderItemModifier.organizationId],
      references: [organization.id],
    }),
    orderItem: one(restaurantOrderItem, {
      fields: [restaurantOrderItemModifier.orderItemId],
      references: [restaurantOrderItem.id],
    }),
    modifierProduct: one(product, {
      fields: [restaurantOrderItemModifier.modifierProductId],
      references: [product.id],
    }),
  })
);
