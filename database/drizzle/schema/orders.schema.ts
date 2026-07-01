import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";
import { customer } from "./customer.schema";
import { product } from "./inventory.schema";
import { sale } from "./sales.schema";

export const pedido = pgTable(
  "pedido",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customer.id, {
      onDelete: "set null",
    }),
    saleId: text("sale_id").references(() => sale.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    orderNumber: integer("order_number").notNull(),
    status: text("status").notNull().default("pending"),
    fulfillment: text("fulfillment").notNull().default("takeaway"),
    source: text("source").notNull().default("web"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    deliveryAddress: text("delivery_address"),
    deliveryNotes: text("delivery_notes"),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("pedido_organizationId_idx").on(table.organizationId),
    index("pedido_status_idx").on(table.status),
    uniqueIndex("pedido_org_number_uidx").on(
      table.organizationId,
      table.orderNumber
    ),
    uniqueIndex("pedido_saleId_uidx").on(table.saleId),
  ]
);

export const pedidoItem = pgTable(
  "pedido_item",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => pedido.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxRate: integer("tax_rate").default(0).notNull(),
    totalAmount: integer("total_amount").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("pedidoItem_organizationId_idx").on(table.organizationId),
    index("pedidoItem_orderId_idx").on(table.orderId),
  ]
);

export const pedidoRelations = relations(pedido, ({ one, many }) => ({
  organization: one(organization, {
    fields: [pedido.organizationId],
    references: [organization.id],
  }),
  customer: one(customer, {
    fields: [pedido.customerId],
    references: [customer.id],
  }),
  sale: one(sale, {
    fields: [pedido.saleId],
    references: [sale.id],
  }),
  acceptedByUser: one(user, {
    fields: [pedido.acceptedByUserId],
    references: [user.id],
    relationName: "pedidoAcceptedBy",
  }),
  items: many(pedidoItem),
}));

export const pedidoItemRelations = relations(pedidoItem, ({ one }) => ({
  organization: one(organization, {
    fields: [pedidoItem.organizationId],
    references: [organization.id],
  }),
  order: one(pedido, {
    fields: [pedidoItem.orderId],
    references: [pedido.id],
  }),
  product: one(product, {
    fields: [pedidoItem.productId],
    references: [product.id],
  }),
}));
