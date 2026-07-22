import { describe, expect, test } from "bun:test";
import ExcelJS from "@protobi/exceljs";
import { ProductImportFileError } from "@/features/product-imports/product-importer.server";
import { listProductImporters } from "@/features/product-imports/product-importer-registry.server";
import {
  PROGRAM_ONE_IMPORTER_KEY,
  programOneImporter,
} from "@/features/product-imports/program-one.server";

const HEADERS = [
  "",
  "",
  "Acciones",
  "Producto",
  "Sucursal",
  "Precio compra",
  "Precio venta",
  "Inventario actual",
  "Tipo de producto",
  "Categoría",
  "Marca",
  "Impuesto",
  "SKU/Código",
  "Campo_1",
  "Campo_2",
  "Campo_3",
  "Campo_4",
];

const PRODUCT = [
  "",
  "",
  "Acciones",
  "Café especial",
  "Sucursal centro",
  "$ 4,500.00",
  "$ 12,000.00",
  "2,451  Unidad",
  "Sencillo",
  "Bebidas",
  "",
  "Exento",
  "77012345678901234567",
  "",
  "",
  "",
  "",
];

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildCsv(rows: string[][]) {
  return new TextEncoder().encode(
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
  );
}

async function buildXlsx(rows: (number | string)[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.mergeCells("A1:Q1");
  sheet.getCell("A1").value = "Productos - Tienda";
  sheet.addRow(HEADERS);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("Programa 1 product importer", () => {
  test("is discoverable and accepts CSV and XLSX without a template", () => {
    expect(programOneImporter).toMatchObject({
      key: PROGRAM_ONE_IMPORTER_KEY,
      label: "Programa 1",
      acceptedExtensions: [".csv", ".xlsx"],
    });
    expect("template" in programOneImporter).toBe(false);
    expect(
      listProductImporters().find(
        (importer) => importer.key === PROGRAM_ONE_IMPORTER_KEY
      )
    ).toMatchObject({ template: null });
  });

  test("parses CSV without losing long source identifiers", async () => {
    const parsed = await programOneImporter.parse(buildCsv([HEADERS, PRODUCT]));

    expect(parsed.sourceRows).toHaveLength(1);
    expect(parsed.sourceRows[0]).toMatchObject({
      productIndex: 0,
      rowNumber: 2,
      sourceReference: "CSV!2",
      issues: [],
    });
    expect(parsed.document.products[0]).toMatchObject({
      name: "Café especial",
      categoryName: "Bebidas",
      sku: "77012345678901234567",
      barcode: null,
      cost: 4500,
      price: 12_000,
      initialStock: 2451,
      taxRate: 0,
      trackInventory: true,
    });
  });

  test("produces the same canonical product from a safe XLSX row", async () => {
    const safeProduct = [...PRODUCT];
    safeProduct[12] = "7701234567890";
    const [csv, xlsx] = await Promise.all([
      programOneImporter.parse(buildCsv([HEADERS, safeProduct])),
      programOneImporter.parse(
        await buildXlsx([
          safeProduct.map((value, index) =>
            index === 12 ? Number(value) : value
          ),
        ])
      ),
    ]);

    expect(xlsx.document).toEqual(csv.document);
    expect(xlsx.sourceRows[0]).toMatchObject({
      productIndex: 0,
      rowNumber: 3,
      sourceReference: "Sheet1!3",
      issues: [],
    });
  });

  test("rejects XLSX identifiers that Excel cannot represent precisely", async () => {
    const unsafeProduct: (number | string)[] = [...PRODUCT];
    unsafeProduct[12] = Number("11111111111111111111");
    const parsed = await programOneImporter.parse(
      await buildXlsx([unsafeProduct])
    );

    expect(parsed.document.products).toEqual([]);
    expect(parsed.sourceRows[0].productIndex).toBeNull();
    expect(parsed.sourceRows[0].issues).toContainEqual({
      code: "unsafe_identifier_precision",
      field: "sku",
      message:
        "Excel convirtió este código a un número sin precisión. Exporta y usa el archivo CSV para conservarlo exactamente.",
    });
  });

  test("reports unsupported product types and unknown taxes per row", async () => {
    const invalidProduct = [...PRODUCT];
    invalidProduct[8] = "Compuesto";
    invalidProduct[11] = "Impuesto especial";
    const parsed = await programOneImporter.parse(
      buildCsv([HEADERS, invalidProduct])
    );

    expect(parsed.document.products).toEqual([]);
    expect(parsed.sourceRows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_product_type" }),
        expect.objectContaining({ code: "invalid_tax" }),
      ])
    );
  });

  test("rejects files without the Programa 1 headers", async () => {
    await expect(
      programOneImporter.parse(buildCsv([["nombre", "precio"]]))
    ).rejects.toBeInstanceOf(ProductImportFileError);
  });
});
