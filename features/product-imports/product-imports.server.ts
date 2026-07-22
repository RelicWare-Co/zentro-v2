import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import {
  productImportBatch,
  productImportRow,
} from "@/database/drizzle/schema/product-import.schema";
import { recordInitialInventoryMovements } from "@/features/inventory/inventory-operations.server";
import { normalizeCreateProductValues } from "@/features/products/product-create-values.shared";
import { getEnabledPaymentMethodIds } from "@/features/settings/payment-methods.server";
import { ProductImportFileError } from "./product-importer.server";
import {
  getProductImporter,
  listProductImporters,
} from "./product-importer-registry.server";
import {
  PRODUCT_IMPORT_MAX_FILE_BYTES,
  PRODUCT_IMPORT_MAX_ROWS,
  type ProductImportBatchDetail,
  type ProductImportBatchSummary,
  ProductImportDocumentV1Schema,
  type ProductImportHistory,
  type ProductImportIssue,
  type ProductImportProductV1,
  ProductImportProductV1Schema,
} from "./product-imports.schema";

const DB_WRITE_CHUNK_SIZE = 250;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PATH_SEPARATOR_REGEX = /[\\/]/;

type DbExecutor = Pick<Database, "select">;
interface ImportRowForValidation {
  id: string;
  issues: ProductImportIssue[];
  normalizedData: ProductImportProductV1 | null;
  rowNumber: number;
  sourceData?: Record<string, unknown>;
  sourceReference?: string;
}

export interface PreviewProductImportInput {
  bytes: Uint8Array;
  fileName: string;
  fileType: string;
  importerKey: string;
  organizationId: string;
  userEmail: string;
  userId: string;
}

export interface CommitProductImportInput {
  batchId: string;
  userId: string;
}

export class ProductImportOperationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ProductImportOperationError";
    this.code = code;
    this.status = status;
  }
}

function clampPage(value: number | undefined) {
  return Math.max(1, Math.floor(value ?? 1));
}

function clampPageSize(value: number | undefined) {
  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_PAGE_SIZE))
  );
}

function toTimestamp(value: Date | null) {
  return value?.getTime() ?? null;
}

function normalizeCategoryName(value: string) {
  return value.trim().toLocaleLowerCase("es-CO");
}

function cleanFilename(value: string) {
  const name =
    value.split(PATH_SEPARATOR_REGEX).at(-1)?.trim() || "productos.xlsx";
  return name.slice(0, 255);
}

function importerLabel(key: string) {
  return getProductImporter(key)?.label ?? key;
}

function batchRowToSummary(row: {
  completedAt: Date | null;
  createdAt: Date;
  createdByEmail: string;
  createdByUserId: string | null;
  createdCategories: number;
  createdProducts: number;
  errorMessage: string | null;
  fileHash: string;
  fileSize: number;
  formatVersion: string;
  id: string;
  importerKey: string;
  invalidRows: number;
  newCategories: number;
  organizationId: string;
  organizationName: string;
  originalFilename: string;
  status: string;
  totalRows: number;
  validRows: number;
}): ProductImportBatchSummary {
  const status = ["ready", "invalid", "completed", "failed"].includes(
    row.status
  )
    ? (row.status as ProductImportBatchSummary["status"])
    : "failed";
  return {
    ...row,
    status,
    importerLabel: importerLabel(row.importerKey),
    createdAt: row.createdAt.getTime(),
    completedAt: toTimestamp(row.completedAt),
  };
}

async function sha256(bytes: Uint8Array) {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function addRowIssue(
  row: ImportRowForValidation,
  code: string,
  field: string,
  message: string
) {
  if (
    row.issues.some((issue) => issue.code === code && issue.field === field)
  ) {
    return;
  }
  row.issues.push({ code, field, message });
}

function addDuplicateFileIssues(
  rows: ImportRowForValidation[],
  field: "barcode" | "sku"
) {
  const values = new Map<string, ImportRowForValidation[]>();
  for (const row of rows) {
    const value = row.normalizedData?.[field]?.trim();
    if (!value) {
      continue;
    }
    const matching = values.get(value) ?? [];
    matching.push(row);
    values.set(value, matching);
  }
  for (const [value, matchingRows] of values) {
    if (matchingRows.length < 2) {
      continue;
    }
    for (const row of matchingRows) {
      addRowIssue(
        row,
        `duplicate_${field}_in_file`,
        field,
        `El valor "${value}" está repetido dentro del archivo.`
      );
    }
  }
}

async function validateRowsAgainstOrganization(
  db: DbExecutor,
  organizationId: string,
  sourceRows: ImportRowForValidation[]
) {
  const rows = sourceRows.map((row) => ({
    ...row,
    issues: [...row.issues],
  }));
  addDuplicateFileIssues(rows, "sku");
  addDuplicateFileIssues(rows, "barcode");

  const [existingProducts, existingCategories, enabledPaymentMethods] =
    await Promise.all([
      db
        .select({ barcode: product.barcode, sku: product.sku })
        .from(product)
        .where(
          and(
            eq(product.organizationId, organizationId),
            isNull(product.deletedAt)
          )
        ),
      db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(eq(category.organizationId, organizationId)),
      getEnabledPaymentMethodIds(
        db as Pick<Database, "insert" | "select" | "update">,
        organizationId
      ),
    ]);

  const existingSkus = new Set(
    existingProducts.map((row) => row.sku?.trim()).filter(Boolean)
  );
  const existingBarcodes = new Set(
    existingProducts.map((row) => row.barcode?.trim()).filter(Boolean)
  );
  const categoriesByName = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  for (const categoryRow of existingCategories) {
    const key = normalizeCategoryName(categoryRow.name);
    const matching = categoriesByName.get(key) ?? [];
    matching.push(categoryRow);
    categoriesByName.set(key, matching);
  }

  for (const row of rows) {
    const value = row.normalizedData;
    if (!value) {
      continue;
    }
    if (value.sku && existingSkus.has(value.sku)) {
      addRowIssue(
        row,
        "sku_already_exists",
        "sku",
        `Ya existe un producto activo con el SKU "${value.sku}".`
      );
    }
    if (value.barcode && existingBarcodes.has(value.barcode)) {
      addRowIssue(
        row,
        "barcode_already_exists",
        "barcode",
        `Ya existe un producto activo con el código de barras "${value.barcode}".`
      );
    }
    if (value.categoryName) {
      const matching =
        categoriesByName.get(normalizeCategoryName(value.categoryName)) ?? [];
      if (matching.length > 1) {
        addRowIssue(
          row,
          "ambiguous_category",
          "categoryName",
          `Hay varias categorías existentes llamadas "${value.categoryName}".`
        );
      }
    }
    if (
      value.autoPayoutEnabled &&
      !enabledPaymentMethods.has(value.autoPayoutPaymentMethod)
    ) {
      addRowIssue(
        row,
        "payment_method_not_enabled",
        "autoPayoutPaymentMethod",
        `El método de pago "${value.autoPayoutPaymentMethod}" no está habilitado en la organización.`
      );
    }
  }
  return rows;
}

async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>
) {
  for (let index = 0; index < rows.length; index += DB_WRITE_CHUNK_SIZE) {
    await insert(rows.slice(index, index + DB_WRITE_CHUNK_SIZE));
  }
}

async function loadBatchSummary(db: DbExecutor, batchId: string) {
  const [row] = await db
    .select({
      id: productImportBatch.id,
      organizationId: productImportBatch.organizationId,
      organizationName: organization.name,
      importerKey: productImportBatch.importerKey,
      formatVersion: productImportBatch.formatVersion,
      originalFilename: productImportBatch.originalFilename,
      fileSize: productImportBatch.fileSize,
      fileHash: productImportBatch.fileHash,
      status: productImportBatch.status,
      totalRows: productImportBatch.totalRows,
      validRows: productImportBatch.validRows,
      invalidRows: productImportBatch.invalidRows,
      newCategories: productImportBatch.newCategories,
      createdProducts: productImportBatch.createdProducts,
      createdCategories: productImportBatch.createdCategories,
      createdByUserId: productImportBatch.createdByUserId,
      createdByEmail: productImportBatch.createdByEmail,
      errorMessage: productImportBatch.errorMessage,
      createdAt: productImportBatch.createdAt,
      completedAt: productImportBatch.completedAt,
    })
    .from(productImportBatch)
    .innerJoin(
      organization,
      eq(organization.id, productImportBatch.organizationId)
    )
    .where(eq(productImportBatch.id, batchId))
    .limit(1);
  return row ? batchRowToSummary(row) : null;
}

async function persistPreview(
  db: Database,
  input: {
    batchId: string;
    errorMessage: string | null;
    fileHash: string;
    fileName: string;
    fileSize: number;
    formatVersion: string;
    importerKey: string;
    organizationId: string;
    newCategories: number;
    rows: ImportRowForValidation[];
    userEmail: string;
    userId: string;
  }
) {
  const now = new Date();
  const invalidRows = input.rows.filter((row) => row.issues.length > 0).length;
  const status = input.errorMessage || invalidRows > 0 ? "invalid" : "ready";

  await db.transaction(async (tx) => {
    await tx.insert(productImportBatch).values({
      id: input.batchId,
      organizationId: input.organizationId,
      importerKey: input.importerKey,
      formatVersion: input.formatVersion,
      originalFilename: input.fileName,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      status,
      totalRows: input.rows.length,
      validRows: input.rows.length - invalidRows,
      invalidRows,
      newCategories: input.newCategories,
      createdProducts: 0,
      createdCategories: 0,
      createdByUserId: input.userId,
      createdByEmail: input.userEmail,
      errorMessage: input.errorMessage,
      createdAt: now,
      updatedAt: now,
    });
    const rowValues = input.rows.map((row) => ({
      id: row.id,
      batchId: input.batchId,
      rowNumber: row.rowNumber,
      sourceReference: row.sourceReference ?? `Fila ${row.rowNumber}`,
      sourceData: row.sourceData ?? {},
      normalizedData: row.normalizedData,
      issues: row.issues,
      status: row.issues.length > 0 ? "invalid" : "valid",
      productId: null,
      createdAt: now,
      updatedAt: now,
    }));
    await insertInChunks(rowValues, (chunk) =>
      tx.insert(productImportRow).values(chunk)
    );
  });
}

export function getProductImporterDescriptors() {
  return listProductImporters();
}

async function countNewCategories(
  db: DbExecutor,
  organizationId: string,
  rows: ImportRowForValidation[]
) {
  const existing = await db
    .select({ name: category.name })
    .from(category)
    .where(eq(category.organizationId, organizationId));
  const existingNames = new Set(
    existing.map((row) => normalizeCategoryName(row.name))
  );
  const requestedNames = new Set(
    rows
      .filter((row) => row.issues.length === 0)
      .map((row) => row.normalizedData?.categoryName)
      .filter((name): name is string => Boolean(name))
      .map(normalizeCategoryName)
  );
  return Array.from(requestedNames).filter((name) => !existingNames.has(name))
    .length;
}

export async function runPreviewProductImport(
  db: Database,
  input: PreviewProductImportInput
) {
  const importer = getProductImporter(input.importerKey);
  if (!importer) {
    throw new ProductImportOperationError(
      "unknown_importer",
      "El importador seleccionado no existe."
    );
  }
  if (input.bytes.byteLength > PRODUCT_IMPORT_MAX_FILE_BYTES) {
    throw new ProductImportOperationError(
      "file_too_large",
      "El archivo supera el límite de 5 MiB.",
      413
    );
  }

  const fileName = cleanFilename(input.fileName);
  const extension = `.${fileName.split(".").at(-1)?.toLowerCase() ?? ""}`;
  if (!importer.acceptedExtensions.includes(extension)) {
    throw new ProductImportOperationError(
      "invalid_extension",
      `El importador sólo acepta: ${importer.acceptedExtensions.join(", ")}.`
    );
  }
  if (
    input.fileType &&
    input.fileType !== "application/octet-stream" &&
    !importer.acceptedMimeTypes.includes(input.fileType)
  ) {
    throw new ProductImportOperationError(
      "invalid_mime_type",
      "El tipo del archivo no corresponde al importador seleccionado."
    );
  }

  const [organizationRow] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!organizationRow) {
    throw new ProductImportOperationError(
      "organization_not_found",
      "No se encontró la organización.",
      404
    );
  }

  const fileHash = await sha256(input.bytes);
  const [completedDuplicate] = await db
    .select({ id: productImportBatch.id })
    .from(productImportBatch)
    .where(
      and(
        eq(productImportBatch.organizationId, input.organizationId),
        eq(productImportBatch.fileHash, fileHash),
        eq(productImportBatch.status, "completed")
      )
    )
    .limit(1);
  const batchId = crypto.randomUUID();
  if (completedDuplicate) {
    const message = `Este archivo ya fue importado en el lote ${completedDuplicate.id}.`;
    await persistPreview(db, {
      batchId,
      organizationId: input.organizationId,
      importerKey: input.importerKey,
      formatVersion: "unknown",
      fileName,
      fileSize: input.bytes.byteLength,
      fileHash,
      userId: input.userId,
      userEmail: input.userEmail,
      errorMessage: message,
      newCategories: 0,
      rows: [],
    });
    return loadProductImportDetail(db, batchId, { rowPage: 1 });
  }

  try {
    const parsed = await importer.parse(input.bytes);
    const documentResult = ProductImportDocumentV1Schema.safeParse(
      parsed.document
    );
    if (!documentResult.success) {
      throw new ProductImportFileError(
        "invalid_canonical_document",
        "El importador produjo un documento canónico no válido."
      );
    }
    if (
      parsed.sourceRows.length === 0 ||
      parsed.sourceRows.length > PRODUCT_IMPORT_MAX_ROWS
    ) {
      throw new ProductImportFileError(
        "invalid_source_rows",
        `El importador debe producir entre 1 y ${PRODUCT_IMPORT_MAX_ROWS} filas de origen.`
      );
    }
    const productIndexes = parsed.sourceRows.flatMap((row) =>
      row.productIndex === null ? [] : [row.productIndex]
    );
    const uniqueProductIndexes = new Set(productIndexes);
    if (
      productIndexes.some(
        (index) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= documentResult.data.products.length
      ) ||
      uniqueProductIndexes.size !== productIndexes.length ||
      uniqueProductIndexes.size !== documentResult.data.products.length
    ) {
      throw new ProductImportFileError(
        "invalid_product_references",
        "Las referencias de origen no corresponden uno a uno con los productos del documento canónico."
      );
    }
    const rowsWithIds = parsed.sourceRows.map((row) => ({
      id: crypto.randomUUID(),
      rowNumber: row.rowNumber,
      sourceReference: row.sourceReference,
      sourceData: row.sourceData,
      normalizedData:
        row.productIndex === null
          ? null
          : documentResult.data.products[row.productIndex],
      issues: [...row.issues],
    }));
    const validatedRows = await validateRowsAgainstOrganization(
      db,
      input.organizationId,
      rowsWithIds
    );
    const newCategories = await countNewCategories(
      db,
      input.organizationId,
      validatedRows
    );
    const sourceById = new Map<string, (typeof rowsWithIds)[number]>(
      rowsWithIds.map((row) => [row.id, row])
    );
    const rows = validatedRows.map((row) => ({
      ...row,
      sourceData: sourceById.get(row.id)?.sourceData ?? {},
      sourceReference:
        sourceById.get(row.id)?.sourceReference ?? `Fila ${row.rowNumber}`,
    }));
    await persistPreview(db, {
      batchId,
      organizationId: input.organizationId,
      importerKey: input.importerKey,
      formatVersion: documentResult.data.version,
      fileName,
      fileSize: input.bytes.byteLength,
      fileHash,
      userId: input.userId,
      userEmail: input.userEmail,
      errorMessage: null,
      newCategories,
      rows,
    });
  } catch (error) {
    if (!(error instanceof ProductImportFileError)) {
      throw error;
    }
    await persistPreview(db, {
      batchId,
      organizationId: input.organizationId,
      importerKey: input.importerKey,
      formatVersion: "unknown",
      fileName,
      fileSize: input.bytes.byteLength,
      fileHash,
      userId: input.userId,
      userEmail: input.userEmail,
      errorMessage: error.message,
      newCategories: 0,
      rows: [],
    });
  }

  return loadProductImportDetail(db, batchId, { rowPage: 1 });
}

export async function loadProductImportHistory(
  db: Database,
  input: {
    organizationId?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ProductImportHistory> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const filter = input.organizationId
    ? eq(productImportBatch.organizationId, input.organizationId)
    : undefined;
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: productImportBatch.id,
        organizationId: productImportBatch.organizationId,
        organizationName: organization.name,
        importerKey: productImportBatch.importerKey,
        formatVersion: productImportBatch.formatVersion,
        originalFilename: productImportBatch.originalFilename,
        fileSize: productImportBatch.fileSize,
        fileHash: productImportBatch.fileHash,
        status: productImportBatch.status,
        totalRows: productImportBatch.totalRows,
        validRows: productImportBatch.validRows,
        invalidRows: productImportBatch.invalidRows,
        newCategories: productImportBatch.newCategories,
        createdProducts: productImportBatch.createdProducts,
        createdCategories: productImportBatch.createdCategories,
        createdByUserId: productImportBatch.createdByUserId,
        createdByEmail: productImportBatch.createdByEmail,
        errorMessage: productImportBatch.errorMessage,
        createdAt: productImportBatch.createdAt,
        completedAt: productImportBatch.completedAt,
      })
      .from(productImportBatch)
      .innerJoin(
        organization,
        eq(organization.id, productImportBatch.organizationId)
      )
      .where(filter)
      .orderBy(desc(productImportBatch.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(productImportBatch).where(filter),
  ]);
  return {
    batches: rows.map(batchRowToSummary),
    page,
    pageSize,
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function loadProductImportDetail(
  db: Database,
  batchId: string,
  input: { rowPage?: number; rowPageSize?: number }
): Promise<ProductImportBatchDetail | null> {
  const rowPage = clampPage(input.rowPage);
  const rowPageSize = clampPageSize(input.rowPageSize);
  const batch = await loadBatchSummary(db, batchId);
  if (!batch) {
    return null;
  }
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(productImportRow)
      .where(eq(productImportRow.batchId, batchId))
      .orderBy(asc(productImportRow.rowNumber))
      .limit(rowPageSize)
      .offset((rowPage - 1) * rowPageSize),
    db
      .select({ total: count() })
      .from(productImportRow)
      .where(eq(productImportRow.batchId, batchId)),
  ]);
  return {
    batch,
    rows: rows.map((row) => {
      const normalizedResult = ProductImportProductV1Schema.safeParse(
        row.normalizedData
      );
      return {
        id: row.id,
        rowNumber: row.rowNumber,
        sourceReference: row.sourceReference,
        sourceData: row.sourceData,
        normalizedData: normalizedResult.success ? normalizedResult.data : null,
        issues: row.issues,
        status:
          row.status === "valid" ||
          row.status === "invalid" ||
          row.status === "imported"
            ? row.status
            : "invalid",
        productId: row.productId,
      };
    }),
    rowPage,
    rowPageSize,
    rowTotal: Number(countRows[0]?.total ?? 0),
  };
}

async function updateRowsAfterRevalidation(
  tx: Database,
  batchId: string,
  rows: ImportRowForValidation[]
) {
  const now = new Date();
  for (let index = 0; index < rows.length; index += DB_WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + DB_WRITE_CHUNK_SIZE);
    await Promise.all(
      chunk.map((row) =>
        tx
          .update(productImportRow)
          .set({
            issues: row.issues,
            status: row.issues.length > 0 ? "invalid" : "valid",
            updatedAt: now,
          })
          .where(eq(productImportRow.id, row.id))
      )
    );
  }
  const invalidRows = rows.filter((row) => row.issues.length > 0).length;
  await tx
    .update(productImportBatch)
    .set({
      status: "invalid",
      validRows: rows.length - invalidRows,
      invalidRows,
      errorMessage: "La información cambió desde la previsualización.",
      updatedAt: now,
    })
    .where(eq(productImportBatch.id, batchId));
}

export async function runCommitProductImport(
  db: Database,
  input: CommitProductImportInput
) {
  try {
    const result = await db.transaction(async (tx) => {
      const [batch] = await tx
        .select()
        .from(productImportBatch)
        .where(eq(productImportBatch.id, input.batchId))
        .for("update")
        .limit(1);
      if (!batch) {
        throw new ProductImportOperationError(
          "batch_not_found",
          "No se encontró la importación.",
          404
        );
      }
      if (batch.status === "completed") {
        return { completed: true as const };
      }
      if (batch.status !== "ready") {
        throw new ProductImportOperationError(
          "batch_not_ready",
          "La importación no está lista para confirmar.",
          409
        );
      }

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${batch.organizationId}, 0))`
      );
      const [completedDuplicate] = await tx
        .select({ id: productImportBatch.id })
        .from(productImportBatch)
        .where(
          and(
            eq(productImportBatch.organizationId, batch.organizationId),
            eq(productImportBatch.fileHash, batch.fileHash),
            eq(productImportBatch.status, "completed"),
            ne(productImportBatch.id, batch.id)
          )
        )
        .limit(1);
      if (completedDuplicate) {
        await tx
          .update(productImportBatch)
          .set({
            status: "invalid",
            errorMessage: `Este archivo ya fue importado en el lote ${completedDuplicate.id}.`,
            updatedAt: new Date(),
          })
          .where(eq(productImportBatch.id, batch.id));
        return { completed: false as const };
      }

      const storedRows = await tx
        .select()
        .from(productImportRow)
        .where(eq(productImportRow.batchId, batch.id))
        .orderBy(asc(productImportRow.rowNumber));
      const rows: ImportRowForValidation[] = storedRows.map((row) => {
        const parsed = ProductImportProductV1Schema.safeParse(
          row.normalizedData
        );
        return {
          id: row.id,
          rowNumber: row.rowNumber,
          normalizedData: parsed.success ? parsed.data : null,
          issues: parsed.success
            ? []
            : [
                {
                  code: "invalid_normalized_data",
                  field: null,
                  message:
                    "Los datos normalizados de esta fila no son válidos.",
                },
              ],
        };
      });
      const revalidatedRows = await validateRowsAgainstOrganization(
        tx,
        batch.organizationId,
        rows
      );
      if (revalidatedRows.some((row) => row.issues.length > 0)) {
        await updateRowsAfterRevalidation(
          tx as unknown as Database,
          batch.id,
          revalidatedRows
        );
        return { completed: false as const };
      }

      const now = new Date();
      const existingCategories = await tx
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(eq(category.organizationId, batch.organizationId));
      const categoryIdByName = new Map(
        existingCategories.map((row) => [
          normalizeCategoryName(row.name),
          row.id,
        ])
      );
      const requestedCategoryNames = new Map<string, string>();
      for (const row of revalidatedRows) {
        const name = row.normalizedData?.categoryName;
        if (name) {
          requestedCategoryNames.set(normalizeCategoryName(name), name.trim());
        }
      }
      const categoryRows = Array.from(requestedCategoryNames)
        .filter(([key]) => !categoryIdByName.has(key))
        .map(([key, name]) => {
          const id = crypto.randomUUID();
          categoryIdByName.set(key, id);
          return {
            id,
            organizationId: batch.organizationId,
            name,
            description: null,
            createdAt: now,
          };
        });
      await insertInChunks(categoryRows, (chunk) =>
        tx.insert(category).values(chunk)
      );

      const createdProducts = revalidatedRows.map((row) => {
        const canonical = row.normalizedData;
        if (!canonical) {
          throw new Error(`Fila normalizada ausente: ${row.rowNumber}`);
        }
        const values = normalizeCreateProductValues({
          ...canonical,
          stock: canonical.initialStock,
        });
        const id = crypto.randomUUID();
        return {
          importRowId: row.id,
          inventory: {
            id,
            initialStock: values.stock,
            trackInventory: values.trackInventory,
          },
          row: {
            id,
            organizationId: batch.organizationId,
            categoryId: canonical.categoryName
              ? (categoryIdByName.get(
                  normalizeCategoryName(canonical.categoryName)
                ) ?? null)
              : null,
            ...values,
            deletedAt: null,
            createdAt: now,
          },
        };
      });
      await insertInChunks(
        createdProducts.map((entry) => entry.row),
        (chunk) => tx.insert(product).values(chunk)
      );
      await recordInitialInventoryMovements(tx, {
        batchId: batch.id,
        organizationId: batch.organizationId,
        userId: input.userId,
        products: createdProducts.map((entry) => entry.inventory),
        createdAt: now,
      });

      for (
        let index = 0;
        index < createdProducts.length;
        index += DB_WRITE_CHUNK_SIZE
      ) {
        const chunk = createdProducts.slice(index, index + DB_WRITE_CHUNK_SIZE);
        await Promise.all(
          chunk.map((entry) =>
            tx
              .update(productImportRow)
              .set({
                productId: entry.row.id,
                status: "imported",
                issues: [],
                updatedAt: now,
              })
              .where(eq(productImportRow.id, entry.importRowId))
          )
        );
      }
      await tx
        .update(productImportBatch)
        .set({
          status: "completed",
          createdProducts: createdProducts.length,
          createdCategories: categoryRows.length,
          errorMessage: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(productImportBatch.id, batch.id));
      return { completed: true as const };
    });

    const detail = await loadProductImportDetail(db, input.batchId, {
      rowPage: 1,
    });
    if (!detail) {
      throw new ProductImportOperationError(
        "batch_not_found",
        "No se encontró la importación.",
        404
      );
    }
    if (!result.completed) {
      return detail;
    }
    return detail;
  } catch (error) {
    if (error instanceof ProductImportOperationError) {
      throw error;
    }
    await db
      .update(productImportBatch)
      .set({
        status: "failed",
        errorMessage: "La importación falló y no se creó ningún producto.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productImportBatch.id, input.batchId),
          eq(productImportBatch.status, "ready")
        )
      );
    throw error;
  }
}
