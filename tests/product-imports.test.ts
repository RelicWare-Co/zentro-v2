import { describe, expect, test } from "bun:test";
import ExcelJS from "@protobi/exceljs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires the complete schema map
import * as schema from "@/database/drizzle/schema";
import {
  category,
  inventoryMovement,
  product,
} from "@/database/drizzle/schema/inventory.schema";
import { productImportBatch } from "@/database/drizzle/schema/product-import.schema";
import {
  runCommitProductImport,
  runPreviewProductImport,
} from "@/features/product-imports/product-imports.server";
import {
  XLSX_MIME_TYPE,
  ZENTRO_STANDARD_IMPORTER_KEY,
  zentroStandardXlsxImporter,
} from "@/features/product-imports/zentro-standard-xlsx.server";
import {
  seedCategory,
  seedOrganizationWithMember,
  seedProduct,
} from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";

interface ProductFixture {
  accountingTreatment?: "passthrough" | "revenue";
  autoPayoutEnabled?: boolean;
  barcode?: string;
  category?: string;
  name: string;
  paymentMethod?: string;
  price: number;
  sku?: string;
  stock?: number;
  trackInventory?: boolean;
}

function asArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function buildImportFile(rows: ProductFixture[]) {
  const template = await zentroStandardXlsxImporter.template?.build();
  if (!template) {
    throw new Error("Missing XLSX template builder");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(asArrayBuffer(template));
  const sheet = workbook.getWorksheet("Productos");
  if (!sheet) {
    throw new Error("Missing Productos sheet");
  }
  rows.forEach((row, index) => {
    sheet.getRow(index + 2).values = [
      row.name,
      row.category ?? "",
      row.sku ?? "",
      row.barcode ?? "",
      row.price,
      0,
      0,
      row.stock ?? 0,
      "",
      "",
      row.trackInventory === false ? "NO" : "SI",
      "NO",
      "NO",
      row.accountingTreatment ?? "revenue",
      row.autoPayoutEnabled ? "SI" : "NO",
      row.paymentMethod ?? "cash",
    ];
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function preview(
  db: TestDb,
  input: {
    bytes: Uint8Array;
    organizationId: string;
    userId: string;
  }
) {
  return runPreviewProductImport(db, {
    ...input,
    importerKey: ZENTRO_STANDARD_IMPORTER_KEY,
    fileName: "productos.xlsx",
    fileType: XLSX_MIME_TYPE,
    userEmail: "admin@zentro.test",
  });
}

describe("product imports", () => {
  test("previews without catalog writes and commits products atomically with stock history", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      await seedCategory(db, { organizationId, name: "Bebidas" });
      const bytes = await buildImportFile([
        {
          name: "Cola importada",
          category: " bebidas ",
          sku: "IMP-001",
          barcode: "770000000001",
          price: 5000,
          stock: 12,
        },
        {
          name: "Pan importado",
          category: "Panadería",
          sku: "IMP-002",
          price: 2500,
        },
      ]);

      const detail = await preview(db, { bytes, organizationId, userId });

      expect(detail?.batch).toMatchObject({
        status: "ready",
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        newCategories: 1,
      });
      expect(
        await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId))
      ).toHaveLength(0);

      const committed = await runCommitProductImport(db, {
        batchId: detail?.batch.id ?? "",
        userId,
      });
      expect(committed.batch).toMatchObject({
        status: "completed",
        createdProducts: 2,
        createdCategories: 1,
      });
      const products = await db
        .select()
        .from(product)
        .where(eq(product.organizationId, organizationId));
      expect(products).toHaveLength(2);
      expect(products.find((row) => row.sku === "IMP-001")?.stock).toBe(12);
      const movements = await db
        .select()
        .from(inventoryMovement)
        .where(eq(inventoryMovement.organizationId, organizationId));
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        quantity: 12,
        type: "restock",
        userId,
      });
      expect(movements[0].notes).toContain(committed.batch.id);

      const committedAgain = await runCommitProductImport(db, {
        batchId: committed.batch.id,
        userId,
      });
      expect(committedAgain.batch.createdProducts).toBe(2);
      expect(
        await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId))
      ).toHaveLength(2);

      const duplicate = await preview(db, { bytes, organizationId, userId });
      expect(duplicate?.batch.status).toBe("invalid");
      expect(duplicate?.batch.errorMessage).toContain("ya fue importado");
    } finally {
      await cleanup();
    }
  });

  test("blocks duplicate identifiers inside the file without partial writes", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const bytes = await buildImportFile([
        { name: "Uno", sku: "DUP-1", price: 1000 },
        { name: "Dos", sku: "DUP-1", price: 2000 },
      ]);

      const detail = await preview(db, { bytes, organizationId, userId });

      expect(detail?.batch).toMatchObject({
        status: "invalid",
        invalidRows: 2,
      });
      expect(detail?.rows[0].issues).toContainEqual(
        expect.objectContaining({ code: "duplicate_sku_in_file" })
      );
      expect(
        await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId))
      ).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  test("validates auto payout methods for passthrough products", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const detail = await preview(db, {
        bytes: await buildImportFile([
          {
            name: "Recaudo externo",
            price: 5000,
            accountingTreatment: "passthrough",
            autoPayoutEnabled: true,
            paymentMethod: "not-enabled",
            trackInventory: false,
          },
        ]),
        organizationId,
        userId,
      });

      expect(detail?.batch.status).toBe("invalid");
      expect(detail?.rows[0].normalizedData?.autoPayoutEnabled).toBe(true);
      expect(detail?.rows[0].issues).toContainEqual(
        expect.objectContaining({ code: "payment_method_not_enabled" })
      );
    } finally {
      await cleanup();
    }
  });

  test("scopes barcode conflicts to the target organization", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const firstOrg = await seedOrganizationWithMember(db);
      const secondOrg = await seedOrganizationWithMember(db);
      await seedProduct(db, {
        organizationId: firstOrg.organizationId,
        name: "Existente",
        barcode: "BARCODE-SCOPED",
      });
      const bytes = await buildImportFile([
        {
          name: "Importado",
          barcode: "BARCODE-SCOPED",
          price: 1000,
        },
      ]);

      const conflicting = await preview(db, {
        bytes,
        organizationId: firstOrg.organizationId,
        userId: firstOrg.userId,
      });
      const isolated = await preview(db, {
        bytes,
        organizationId: secondOrg.organizationId,
        userId: secondOrg.userId,
      });

      expect(conflicting?.batch.status).toBe("invalid");
      expect(conflicting?.rows[0].issues).toContainEqual(
        expect.objectContaining({ code: "barcode_already_exists" })
      );
      expect(isolated?.batch.status).toBe("ready");
    } finally {
      await cleanup();
    }
  });

  test("serializes concurrent commits of the same file hash", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const bytes = await buildImportFile([
        { name: "Sin identificadores", price: 1000 },
      ]);
      const [firstPreview, secondPreview] = await Promise.all([
        preview(db, { bytes, organizationId, userId }),
        preview(db, { bytes, organizationId, userId }),
      ]);

      const commits = await Promise.all([
        runCommitProductImport(db, {
          batchId: firstPreview?.batch.id ?? "",
          userId,
        }),
        runCommitProductImport(db, {
          batchId: secondPreview?.batch.id ?? "",
          userId,
        }),
      ]);

      expect(commits.map((result) => result.batch.status).sort()).toEqual([
        "completed",
        "invalid",
      ]);
      expect(
        await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId))
      ).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  test("serializes different files that create the same category", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const first = await preview(db, {
        bytes: await buildImportFile([
          {
            name: "Primero",
            category: "Concurrente",
            sku: "CONCURRENT-CAT-1",
            price: 1000,
          },
        ]),
        organizationId,
        userId,
      });
      const second = await preview(db, {
        bytes: await buildImportFile([
          {
            name: "Segundo",
            category: " concurrente ",
            sku: "CONCURRENT-CAT-2",
            price: 2000,
          },
        ]),
        organizationId,
        userId,
      });
      const firstDb = drizzle(firstClient, { schema });
      const secondDb = drizzle(secondClient, { schema });

      const commits = await Promise.all([
        runCommitProductImport(firstDb, {
          batchId: first?.batch.id ?? "",
          userId,
        }),
        runCommitProductImport(secondDb, {
          batchId: second?.batch.id ?? "",
          userId,
        }),
      ]);

      expect(commits.map((result) => result.batch.status)).toEqual([
        "completed",
        "completed",
      ]);
      expect(
        await db
          .select()
          .from(category)
          .where(eq(category.organizationId, organizationId))
      ).toHaveLength(1);
    } finally {
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
  });

  test("turns a concurrent SKU conflict into an invalid batch", async () => {
    const { db, cleanup, databaseUrl } = await createTestDb();
    const firstClient = postgres(databaseUrl, { max: 1 });
    const secondClient = postgres(databaseUrl, { max: 1 });
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const first = await preview(db, {
        bytes: await buildImportFile([
          { name: "Primero", sku: "CONCURRENT-SKU", price: 1000 },
        ]),
        organizationId,
        userId,
      });
      const second = await preview(db, {
        bytes: await buildImportFile([
          { name: "Segundo", sku: "CONCURRENT-SKU", price: 2000 },
        ]),
        organizationId,
        userId,
      });
      const firstDb = drizzle(firstClient, { schema });
      const secondDb = drizzle(secondClient, { schema });

      const commits = await Promise.all([
        runCommitProductImport(firstDb, {
          batchId: first?.batch.id ?? "",
          userId,
        }),
        runCommitProductImport(secondDb, {
          batchId: second?.batch.id ?? "",
          userId,
        }),
      ]);

      expect(commits.map((result) => result.batch.status).sort()).toEqual([
        "completed",
        "invalid",
      ]);
    } finally {
      await Promise.all([firstClient.end(), secondClient.end()]);
      await cleanup();
    }
  });

  test("revalidates stale previews and creates no imported rows after a conflict", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const bytes = await buildImportFile([
        { name: "Pendiente", sku: "STALE-1", price: 3000 },
      ]);
      const detail = await preview(db, { bytes, organizationId, userId });
      expect(detail?.batch.status).toBe("ready");

      await db.insert(product).values({
        id: crypto.randomUUID(),
        organizationId,
        categoryId: null,
        name: "Creado durante la espera",
        sku: "STALE-1",
        barcode: null,
        price: 3000,
        cost: 0,
        taxRate: 0,
        stock: 0,
        minStock: null,
        reorderQuantity: null,
        trackInventory: true,
        isModifier: false,
        isIngredient: false,
        isFavorite: false,
        accountingTreatment: "revenue",
        autoPayoutEnabled: false,
        autoPayoutPaymentMethod: "cash",
        deletedAt: null,
        createdAt: new Date(),
      });

      const committed = await runCommitProductImport(db, {
        batchId: detail?.batch.id ?? "",
        userId,
      });
      expect(committed.batch.status).toBe("invalid");
      expect(committed.rows[0].issues).toContainEqual(
        expect.objectContaining({ code: "sku_already_exists" })
      );
      expect(
        await db
          .select()
          .from(product)
          .where(
            and(
              eq(product.organizationId, organizationId),
              eq(product.sku, "STALE-1")
            )
          )
      ).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  test("marks case-insensitive duplicate categories as ambiguous", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      await seedCategory(db, { organizationId, name: "Snacks" });
      await seedCategory(db, { organizationId, name: " snacks " });
      const bytes = await buildImportFile([
        { name: "Papas", category: "SNACKS", price: 3000 },
      ]);

      const detail = await preview(db, { bytes, organizationId, userId });

      expect(detail?.batch.status).toBe("invalid");
      expect(detail?.rows[0].issues).toContainEqual(
        expect.objectContaining({ code: "ambiguous_category" })
      );
    } finally {
      await cleanup();
    }
  });

  test("rolls back catalog writes and marks the batch failed on unexpected errors", async () => {
    const { db, cleanup, client } = await createTestDb();
    try {
      const { organizationId, userId } = await seedOrganizationWithMember(db);
      const detail = await preview(db, {
        bytes: await buildImportFile([
          { name: "Debe revertirse", price: 1000, stock: 4 },
        ]),
        organizationId,
        userId,
      });
      await client.unsafe(`
        CREATE FUNCTION reject_import_movement() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'forced inventory failure';
        END;
        $$;
        CREATE TRIGGER reject_import_movement_trigger
        BEFORE INSERT ON inventory_movement
        FOR EACH ROW EXECUTE FUNCTION reject_import_movement();
      `);

      await expect(
        runCommitProductImport(db, {
          batchId: detail?.batch.id ?? "",
          userId,
        })
      ).rejects.toThrow();

      expect(
        await db
          .select()
          .from(product)
          .where(eq(product.organizationId, organizationId))
      ).toHaveLength(0);
      const [failedBatch] = await db
        .select({ status: productImportBatch.status })
        .from(productImportBatch)
        .where(eq(productImportBatch.id, detail?.batch.id ?? ""));
      expect(failedBatch?.status).toBe("failed");
    } finally {
      await cleanup();
    }
  });
});
