import { z } from "zod";
import {
  type NormalizedCreateProductValues,
  normalizeCreateProductValues,
} from "@/features/products/product-create-values.shared";
import { CreateProductSchema } from "@/features/products/products.schema";

export const PRODUCT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMPORT_MAX_ROWS = 5000;
export const PRODUCT_IMPORT_FORMAT_VERSION = "1";

export const ProductImportStatusSchema = z.enum([
  "ready",
  "invalid",
  "completed",
  "failed",
]);

export const ProductImportRowStatusSchema = z.enum([
  "valid",
  "invalid",
  "imported",
]);

export const ProductImportIssueSchema = z.object({
  code: z.string(),
  field: z.string().nullable(),
  message: z.string(),
});

export const ProductImportProductV1Schema = z.object({
  name: z.string(),
  categoryName: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number(),
  cost: z.number(),
  taxRate: z.number(),
  initialStock: z.number(),
  minStock: z.number().nullable(),
  reorderQuantity: z.number().nullable(),
  trackInventory: z.boolean(),
  isModifier: z.boolean(),
  isIngredient: z.boolean(),
  accountingTreatment: z.enum(["revenue", "passthrough"]),
  autoPayoutEnabled: z.boolean(),
  autoPayoutPaymentMethod: z.string(),
});

export const ProductImportDocumentV1Schema = z.object({
  version: z.literal(PRODUCT_IMPORT_FORMAT_VERSION),
  products: ProductImportProductV1Schema.array().max(PRODUCT_IMPORT_MAX_ROWS),
});

export const ProductImportBatchSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  importerKey: z.string(),
  importerLabel: z.string(),
  formatVersion: z.string(),
  originalFilename: z.string(),
  fileSize: z.number().int(),
  fileHash: z.string(),
  status: ProductImportStatusSchema,
  totalRows: z.number().int(),
  validRows: z.number().int(),
  invalidRows: z.number().int(),
  newCategories: z.number().int(),
  createdProducts: z.number().int(),
  createdCategories: z.number().int(),
  createdByUserId: z.string().nullable(),
  createdByEmail: z.string(),
  errorMessage: z.string().nullable(),
  createdAt: z.number().int(),
  completedAt: z.number().int().nullable(),
});

export const ProductImportRowResultSchema = z.object({
  id: z.string(),
  rowNumber: z.number().int(),
  sourceReference: z.string(),
  sourceData: z.record(z.string(), z.unknown()),
  normalizedData: ProductImportProductV1Schema.nullable(),
  issues: ProductImportIssueSchema.array(),
  status: ProductImportRowStatusSchema,
  productId: z.string().nullable(),
});

export const ProductImportBatchDetailSchema = z.object({
  batch: ProductImportBatchSummarySchema,
  rows: ProductImportRowResultSchema.array(),
  rowPage: z.number().int(),
  rowPageSize: z.number().int(),
  rowTotal: z.number().int(),
});

export const ProductImportHistorySchema = z.object({
  batches: ProductImportBatchSummarySchema.array(),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const ProductImporterDescriptorSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  acceptedExtensions: z.string().array(),
  acceptedMimeTypes: z.string().array(),
  template: z
    .object({
      fileName: z.string(),
      mimeType: z.string(),
    })
    .nullable(),
});

export type ProductImportBatchDetail = z.infer<
  typeof ProductImportBatchDetailSchema
>;
export type ProductImportBatchSummary = z.infer<
  typeof ProductImportBatchSummarySchema
>;
export type ProductImportHistory = z.infer<typeof ProductImportHistorySchema>;
export type ProductImportDocumentV1 = z.infer<
  typeof ProductImportDocumentV1Schema
>;
export type ProductImportIssue = z.infer<typeof ProductImportIssueSchema>;
export type ProductImportProductV1 = z.infer<
  typeof ProductImportProductV1Schema
>;
export type ProductImportRowResult = z.infer<
  typeof ProductImportRowResultSchema
>;
export type ProductImporterDescriptor = z.infer<
  typeof ProductImporterDescriptorSchema
>;

function issueFromZod(issue: z.core.$ZodIssue): ProductImportIssue {
  return {
    code: `invalid_${String(issue.code)}`,
    field: issue.path.length > 0 ? issue.path.map(String).join(".") : null,
    message: issue.message,
  };
}

export function normalizeProductImportCandidate(
  candidate: unknown
):
  | { issues: ProductImportIssue[]; product: null }
  | { issues: []; product: ProductImportProductV1 } {
  const candidateResult = ProductImportProductV1Schema.safeParse(candidate);
  if (!candidateResult.success) {
    return {
      product: null,
      issues: candidateResult.error.issues.map(issueFromZod),
    };
  }

  const value = candidateResult.data;
  const productResult = CreateProductSchema.safeParse({
    name: value.name,
    sku: value.sku,
    barcode: value.barcode,
    price: value.price,
    cost: value.cost,
    taxRate: value.taxRate,
    stock: value.initialStock,
    minStock: value.minStock,
    reorderQuantity: value.reorderQuantity,
    trackInventory: value.trackInventory,
    isModifier: value.isModifier,
    isIngredient: value.isIngredient,
    accountingTreatment: value.accountingTreatment,
    autoPayoutEnabled: value.autoPayoutEnabled,
    autoPayoutPaymentMethod: value.autoPayoutPaymentMethod,
  });
  if (!productResult.success) {
    return {
      product: null,
      issues: productResult.error.issues.map(issueFromZod),
    };
  }

  if (!value.trackInventory && value.initialStock !== 0) {
    return {
      product: null,
      issues: [
        {
          code: "stock_without_inventory",
          field: "initialStock",
          message:
            "El stock inicial debe ser 0 cuando el producto no controla inventario.",
        },
      ],
    };
  }

  let normalized: NormalizedCreateProductValues;
  try {
    normalized = normalizeCreateProductValues(productResult.data);
  } catch (error) {
    return {
      product: null,
      issues: [
        {
          code: "invalid_product_value",
          field: null,
          message:
            error instanceof Error
              ? error.message
              : "Los valores del producto no son válidos.",
        },
      ],
    };
  }
  return {
    issues: [],
    product: {
      ...normalized,
      categoryName: value.categoryName?.trim() || null,
      initialStock: normalized.stock,
    },
  };
}
