import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.schema";
import { customer } from "./customer.schema";
import { payment, sale } from "./sales.schema";

export const creditAccount = pgTable(
  "credit_account",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id), // Sin cascade: proteger historial crediticio
    balance: integer("balance").notNull().default(0), // Positivo = El cliente debe dinero
    interestRate: integer("interest_rate").default(0), // % o fijo, si lo manejan
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Un cliente solo puede tener una cuenta de crédito por negocio (organización)
    uniqueIndex("credit_org_customer_uidx").on(
      table.organizationId,
      table.customerId
    ),
  ]
);

export const creditTransaction = pgTable("credit_transaction", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  creditAccountId: text("credit_account_id")
    .notNull()
    .references(() => creditAccount.id, { onDelete: "cascade" }),
  saleId: text("sale_id").references(() => sale.id), // Si la deuda se originó por una venta
  paymentId: text("payment_id").references(() => payment.id), // Si es un abono (vinculado a un ingreso real de caja)
  type: text("type").notNull(), // 'charge' (fiado/deuda), 'payment' (abono), 'interest' (interés generado)
  amount: integer("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const creditAccountRelations = relations(
  creditAccount,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [creditAccount.organizationId],
      references: [organization.id],
    }),
    customer: one(customer, {
      fields: [creditAccount.customerId],
      references: [customer.id],
    }),
    transactions: many(creditTransaction),
  })
);

export const creditTransactionRelations = relations(
  creditTransaction,
  ({ one }) => ({
    organization: one(organization, {
      fields: [creditTransaction.organizationId],
      references: [organization.id],
    }),
    creditAccount: one(creditAccount, {
      fields: [creditTransaction.creditAccountId],
      references: [creditAccount.id],
    }),
    sale: one(sale, {
      fields: [creditTransaction.saleId],
      references: [sale.id],
    }),
    payment: one(payment, {
      fields: [creditTransaction.paymentId],
      references: [payment.id],
    }),
  })
);
