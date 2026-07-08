import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";
import { payment, sale } from "./sales.schema";

export const shift = pgTable(
  "shift",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id), // Cajero
    terminalId: text("terminal_id"), // ID técnico del dispositivo/caja registradora
    terminalName: text("terminal_name"), // Nombre legible (ej: "Caja Principal", "Caja 2")
    status: text("status").notNull().default("open"), // 'open', 'closed'
    startingCash: integer("starting_cash").notNull().default(0), // Base en efectivo
    openedAt: timestamp("opened_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    notes: text("notes"),
  },
  (table) => [
    index("shift_organizationId_openedAt_idx").on(
      table.organizationId,
      table.openedAt
    ),
  ]
);

export const cashMovement = pgTable(
  "cash_movement",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'expense' (gasto operativo), 'payout' (proveedor), 'inflow' (ingreso manual)
    paymentMethod: text("payment_method").notNull().default("cash"),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    sourceType: text("source_type"), // 'sale_auto_payout' para autosalidas de venta passthrough
    sourceSaleId: text("source_sale_id"), // Venta que originó la autosalida (sin cascade para proteger historial)
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("cash_mov_shiftId_idx").on(table.shiftId),
    index("cash_mov_sourceSaleId_idx").on(table.sourceSaleId),
  ]
);

// Conteo al cerrar caja, detallado por método de pago
export const shiftClosure = pgTable(
  "shift_closure",
  {
    id: text("id").primaryKey(),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    paymentMethod: text("payment_method").notNull(), // 'cash', 'card', 'nequi', 'daviplata', etc.
    expectedAmount: integer("expected_amount").notNull(), // Lo que calculó el sistema
    actualAmount: integer("actual_amount").notNull(), // Lo que contó el cajero físico
    difference: integer("difference").notNull(), // (actual - expected) Positivo sobra, negativo falta
  },
  (table) => [index("shift_closure_shiftId_idx").on(table.shiftId)]
);

export const shiftRelations = relations(shift, ({ one, many }) => ({
  organization: one(organization, {
    fields: [shift.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [shift.userId],
    references: [user.id],
  }),
  cashMovements: many(cashMovement),
  closures: many(shiftClosure),
  sales: many(sale),
  payments: many(payment),
}));

export const cashMovementRelations = relations(cashMovement, ({ one }) => ({
  organization: one(organization, {
    fields: [cashMovement.organizationId],
    references: [organization.id],
  }),
  shift: one(shift, {
    fields: [cashMovement.shiftId],
    references: [shift.id],
  }),
}));

export const shiftClosureRelations = relations(shiftClosure, ({ one }) => ({
  shift: one(shift, {
    fields: [shiftClosure.shiftId],
    references: [shift.id],
  }),
}));
