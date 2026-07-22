import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth.schema";
import { product } from "./inventory.schema";

export interface ProductImportStoredIssue {
  code: string;
  field: string | null;
  message: string;
}

export const productImportBatch = pgTable(
  "product_import_batch",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    importerKey: text("importer_key").notNull(),
    formatVersion: text("format_version").notNull(),
    originalFilename: text("original_filename").notNull(),
    fileSize: integer("file_size").notNull(),
    fileHash: text("file_hash").notNull(),
    status: text("status").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    validRows: integer("valid_rows").default(0).notNull(),
    invalidRows: integer("invalid_rows").default(0).notNull(),
    newCategories: integer("new_categories").default(0).notNull(),
    createdProducts: integer("created_products").default(0).notNull(),
    createdCategories: integer("created_categories").default(0).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByEmail: text("created_by_email").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("product_import_batch_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("product_import_batch_hash_idx").on(
      table.organizationId,
      table.fileHash
    ),
  ]
);

export const productImportRow = pgTable(
  "product_import_row",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => productImportBatch.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    sourceReference: text("source_reference").notNull(),
    sourceData: jsonb("source_data").$type<Record<string, unknown>>().notNull(),
    normalizedData: jsonb("normalized_data").$type<Record<
      string,
      unknown
    > | null>(),
    issues: jsonb("issues")
      .$type<ProductImportStoredIssue[]>()
      .default([])
      .notNull(),
    status: text("status").notNull(),
    productId: text("product_id").references(() => product.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("product_import_row_batch_number_uidx").on(
      table.batchId,
      table.rowNumber
    ),
    index("product_import_row_batch_status_idx").on(
      table.batchId,
      table.status,
      table.rowNumber
    ),
  ]
);

export const productImportBatchRelations = relations(
  productImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [productImportBatch.organizationId],
      references: [organization.id],
    }),
    createdBy: one(user, {
      fields: [productImportBatch.createdByUserId],
      references: [user.id],
    }),
    rows: many(productImportRow),
  })
);

export const productImportRowRelations = relations(
  productImportRow,
  ({ one }) => ({
    batch: one(productImportBatch, {
      fields: [productImportRow.batchId],
      references: [productImportBatch.id],
    }),
    product: one(product, {
      fields: [productImportRow.productId],
      references: [product.id],
    }),
  })
);
