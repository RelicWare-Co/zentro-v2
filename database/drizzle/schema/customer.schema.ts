import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization } from "./auth.schema";
import { creditAccount } from "./credit.schema";
import { sale } from "./sales.schema";

export const customer = sqliteTable(
  "customer",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("natural"), // 'natural' o 'legal' (empresa)
    documentType: text("document_type"), // CC, NIT, CE, Pasaporte, etc.
    documentNumber: text("document_number"),
    name: text("name").notNull(), // Nombre o Razón Social
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    taxRegime: text("tax_regime"), // 'responsable_iva', 'no_responsable', etc. (Para FE DIAN)
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }), // Soft delete: null = activo, fecha = eliminado
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customer_organizationId_idx").on(table.organizationId),
    index("customer_document_idx").on(table.documentNumber),
    uniqueIndex("customer_org_doc_uidx").on(
      table.organizationId,
      table.documentNumber
    ),
  ]
);

export const customerRelations = relations(customer, ({ one, many }) => ({
  organization: one(organization, {
    fields: [customer.organizationId],
    references: [organization.id],
  }),
  sales: many(sale),
  // Relación One-to-One: El FK está en la tabla creditAccount, por lo que aquí no lleva fields/references
  creditAccount: one(creditAccount),
}));
