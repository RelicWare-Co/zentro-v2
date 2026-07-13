import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";
import { creditTransaction } from "./credit.schema";
import { customer } from "./customer.schema";
import { product } from "./inventory.schema";
import { shift } from "./pos.schema";

export const sale = pgTable(
  "sale",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shift.id),
    customerId: text("customer_id").references(() => customer.id), // Nulo si es cliente de mostrador (sin registro)
    userId: text("user_id")
      .notNull()
      .references(() => user.id), // Quién hizo la venta
    subtotal: integer("subtotal").notNull().default(0), // Suma de subtotales de items (antes de impuestos y descuentos)
    taxAmount: integer("tax_amount").notNull().default(0), // Total de impuestos de la venta
    discountAmount: integer("discount_amount").notNull().default(0), // Total de descuentos aplicados
    totalAmount: integer("total_amount").notNull(), // subtotal + taxAmount - discountAmount
    passThroughSubtotal: integer("pass_through_subtotal").notNull().default(0), // Subtotal de items no contables
    passThroughTaxAmount: integer("pass_through_tax_amount")
      .notNull()
      .default(0), // Impuesto de items no contables
    passThroughTotalAmount: integer("pass_through_total_amount")
      .notNull()
      .default(0), // Total de items no contables
    status: text("status").notNull().default("completed"), // 'completed', 'credit' (fiado), 'cancelled'
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("sale_organizationId_createdAt_idx").on(
      table.organizationId,
      table.createdAt
    ),
  ]
);

export const saleItem = pgTable(
  "sale_item",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }), // Desnormalización para consultas/reportes rápidos
    productId: text("product_id")
      .notNull()
      .references(() => product.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(), // Precio de venta congelado al momento de la venta
    subtotal: integer("subtotal").notNull(), // quantity * unitPrice
    taxRate: integer("tax_rate").notNull().default(0), // % de impuesto aplicado (congelado)
    taxAmount: integer("tax_amount").notNull().default(0), // Monto de impuesto calculado
    discountAmount: integer("discount_amount").notNull().default(0), // Descuento aplicado al item
    totalAmount: integer("total_amount").notNull().default(0), // subtotal + taxAmount - discountAmount
    accountingTreatment: text("accounting_treatment")
      .notNull()
      .default("revenue"), // Snapshot: 'revenue' o 'passthrough'
  },
  (table) => [index("saleItem_organizationId_idx").on(table.organizationId)]
);

export const saleItemModifier = pgTable(
  "sale_item_modifier",
  {
    id: text("id").primaryKey(),
    saleItemId: text("sale_item_id")
      .notNull()
      .references(() => saleItem.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }), // Desnormalización para consultas
    modifierProductId: text("modifier_product_id")
      .notNull()
      .references(() => product.id), // El producto 'adición'
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    subtotal: integer("subtotal").notNull(),
  },
  (table) => [
    index("saleItemModifier_organizationId_idx").on(table.organizationId),
  ]
);

// Puede haber múltiples pagos por venta (Split Payment)
export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    saleId: text("sale_id").references(() => sale.id, { onDelete: "cascade" }), // Nulo si es el pago a una deuda antigua
    shiftId: text("shift_id")
      .notNull()
      .references(() => shift.id), // Para saber a qué caja entró la plata
    method: text("method").notNull(), // 'cash', 'card', 'transfer_nequi', 'transfer_bancolombia'
    reference: text("reference"), // Número de comprobante, voucher o últimos 4 dígitos de tarjeta
    amount: integer("amount").notNull(), // Monto entregado/cobrado antes de cambio o reversos
    appliedAmount: integer("applied_amount").notNull().default(0), // Monto aplicado a la venta/deuda
    changeAmount: integer("change_amount").notNull().default(0), // Cambio devuelto; negativo en reversos
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [index("payment_saleId_idx").on(table.saleId)]
);

export const saleRelations = relations(sale, ({ one, many }) => ({
  organization: one(organization, {
    fields: [sale.organizationId],
    references: [organization.id],
  }),
  shift: one(shift, {
    fields: [sale.shiftId],
    references: [shift.id],
  }),
  customer: one(customer, {
    fields: [sale.customerId],
    references: [customer.id],
  }),
  user: one(user, {
    fields: [sale.userId],
    references: [user.id],
  }),
  items: many(saleItem),
  payments: many(payment),
  creditTransactions: many(creditTransaction),
}));

export const saleItemRelations = relations(saleItem, ({ one, many }) => ({
  sale: one(sale, {
    fields: [saleItem.saleId],
    references: [sale.id],
  }),
  organization: one(organization, {
    fields: [saleItem.organizationId],
    references: [organization.id],
  }),
  product: one(product, {
    fields: [saleItem.productId],
    references: [product.id],
  }),
  modifiers: many(saleItemModifier),
}));

export const saleItemModifierRelations = relations(
  saleItemModifier,
  ({ one }) => ({
    saleItem: one(saleItem, {
      fields: [saleItemModifier.saleItemId],
      references: [saleItem.id],
    }),
    organization: one(organization, {
      fields: [saleItemModifier.organizationId],
      references: [organization.id],
    }),
    modifierProduct: one(product, {
      fields: [saleItemModifier.modifierProductId],
      references: [product.id],
    }),
  })
);

export const paymentRelations = relations(payment, ({ one, many }) => ({
  organization: one(organization, {
    fields: [payment.organizationId],
    references: [organization.id],
  }),
  sale: one(sale, {
    fields: [payment.saleId],
    references: [sale.id],
  }),
  shift: one(shift, {
    fields: [payment.shiftId],
    references: [shift.id],
  }),
  creditTransactions: many(creditTransaction),
}));
