import { describe, expect, test } from "bun:test";
import ExcelJS from "@protobi/exceljs";
import { ProductImportFileError } from "@/features/product-imports/product-importer.server";
import { ProductImportDocumentV1Schema } from "@/features/product-imports/product-imports.schema";
import {
  ZENTRO_PRODUCT_HEADERS,
  zentroStandardXlsxImporter,
} from "@/features/product-imports/zentro-standard-xlsx.server";
import { normalizeCreateProductValues } from "@/features/products/product-create-values.shared";

function asArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function templateWorkbook() {
  const bytes = await zentroStandardXlsxImporter.template?.build();
  if (!bytes) {
    throw new Error("Missing XLSX template builder");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(asArrayBuffer(bytes));
  return workbook;
}

describe("Zentro standard product import XLSX", () => {
  test("preserves auto payout for passthrough products", () => {
    const normalized = normalizeCreateProductValues({
      name: "Recaudo de terceros",
      price: 10_000,
      accountingTreatment: "passthrough",
      autoPayoutEnabled: true,
      autoPayoutPaymentMethod: "cash",
    });

    expect(normalized.autoPayoutEnabled).toBe(true);
    expect(normalized.autoPayoutPaymentMethod).toBe("cash");
  });

  test("template has versioned sheets, headers, and validations", async () => {
    expect(zentroStandardXlsxImporter.template).toMatchObject({
      fileName: "plantilla-importacion-productos-zentro-v1.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const workbook = await templateWorkbook();

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Instrucciones",
      "Productos",
      "_catalogos",
      "_zentro",
    ]);
    const products = workbook.getWorksheet("Productos");
    const metadata = workbook.getWorksheet("_zentro");
    expect(products).toBeDefined();
    expect(metadata?.state).toBe("veryHidden");
    expect(metadata?.getCell("B1").text).toBe("1");
    expect(
      ZENTRO_PRODUCT_HEADERS.map(
        (_header, index) => products?.getCell(1, index + 1).text
      )
    ).toEqual([...ZENTRO_PRODUCT_HEADERS]);
    expect(products?.getCell("K2").dataValidation.type).toBe("list");
  });

  test("round-trips a complete valid product", async () => {
    const workbook = await templateWorkbook();
    const products = workbook.getWorksheet("Productos");
    if (!products) {
      throw new Error("Missing products sheet");
    }
    products.getRow(2).values = [
      "Café especial",
      "Bebidas",
      "CAF-001",
      "0012345",
      12_000,
      4500,
      19,
      25,
      5,
      10,
      " sí ",
      "NO",
      "NO",
      "revenue",
      "NO",
      "cash",
    ];
    const output = new Uint8Array(await workbook.xlsx.writeBuffer());

    const parsed = await zentroStandardXlsxImporter.parse(output);

    expect(
      ProductImportDocumentV1Schema.safeParse(parsed.document).success
    ).toBe(true);
    expect(parsed.document.version).toBe("1");
    expect(parsed.document.products).toHaveLength(1);
    expect(parsed.sourceRows).toHaveLength(1);
    expect(parsed.sourceRows[0].issues).toEqual([]);
    expect(parsed.sourceRows[0].productIndex).toBe(0);
    expect(parsed.document.products[0]).toMatchObject({
      name: "Café especial",
      categoryName: "Bebidas",
      sku: "CAF-001",
      barcode: "0012345",
      price: 12_000,
      cost: 4500,
      taxRate: 19,
      initialStock: 25,
      trackInventory: true,
    });
  });

  test("reports formulas as row errors", async () => {
    const workbook = await templateWorkbook();
    const products = workbook.getWorksheet("Productos");
    if (!products) {
      throw new Error("Missing products sheet");
    }
    products.getCell("A2").value = "Producto calculado";
    products.getCell("E2").value = { formula: "1000+500", result: 1500 };
    const output = new Uint8Array(await workbook.xlsx.writeBuffer());

    const parsed = await zentroStandardXlsxImporter.parse(output);

    expect(parsed.document.products).toEqual([]);
    expect(parsed.sourceRows[0].productIndex).toBeNull();
    expect(parsed.sourceRows[0].issues).toContainEqual(
      expect.objectContaining({
        code: "formula_not_allowed",
        field: "price",
      })
    );
  });

  test("rejects unsupported format versions", async () => {
    const workbook = await templateWorkbook();
    const metadata = workbook.getWorksheet("_zentro");
    if (!metadata) {
      throw new Error("Missing metadata sheet");
    }
    metadata.getCell("B1").value = "2";
    const output = new Uint8Array(await workbook.xlsx.writeBuffer());

    await expect(
      zentroStandardXlsxImporter.parse(output)
    ).rejects.toBeInstanceOf(ProductImportFileError);
  });
});
