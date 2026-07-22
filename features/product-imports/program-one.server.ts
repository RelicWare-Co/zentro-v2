import { Readable } from "node:stream";
import type { Cell, Worksheet } from "@protobi/exceljs";
import ExcelJS from "@protobi/exceljs";
import type {
  ParsedProductImport,
  ProductImporter,
} from "./product-importer.server";
import { ProductImportFileError } from "./product-importer.server";
import {
  normalizeProductImportCandidate,
  PRODUCT_IMPORT_FORMAT_VERSION,
  PRODUCT_IMPORT_MAX_ROWS,
  type ProductImportIssue,
} from "./product-imports.schema";

export const PROGRAM_ONE_IMPORTER_KEY = "programa-1";

export const PROGRAM_ONE_HEADERS = [
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
] as const;

const REQUIRED_HEADERS = [
  "Producto",
  "Precio compra",
  "Precio venta",
  "Inventario actual",
  "Tipo de producto",
  "Categoría",
  "Impuesto",
  "SKU/Código",
] as const;

const CSV_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/csv",
  "text/comma-separated-values",
  "application/vnd.ms-excel",
] as const;

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const WHITESPACE_PATTERN = /\s+/g;
const GROUPED_NUMBER_PATTERN = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const CURRENCY_PREFIX_PATTERN = /^\$\s*/;
const STOCK_UNIT_SUFFIX_PATTERN = /\s+unidad(?:es)?\s*$/i;
const PERCENTAGE_PATTERN = /(-?\d+(?:[.,]\d+)?)\s*%/;

type ProgramOneHeader = (typeof PROGRAM_ONE_HEADERS)[number];

interface ProgramOneSheet {
  label: string;
  sheet: Worksheet;
}

function addIssue(
  issues: ProductImportIssue[],
  code: string,
  field: string,
  message: string
) {
  issues.push({ code, field, message });
}

function isFormulaCell(cell: Cell) {
  const value = cell.value;
  return Boolean(
    cell.formula ||
      (value &&
        typeof value === "object" &&
        ("formula" in value || "sharedFormula" in value))
  );
}

function sourceCellValue(cell: Cell): unknown {
  if (cell.value === null || cell.value === undefined) {
    return null;
  }
  if (
    typeof cell.value === "string" ||
    typeof cell.value === "number" ||
    typeof cell.value === "boolean"
  ) {
    return cell.value;
  }
  if (cell.value instanceof Date) {
    return cell.value.toISOString();
  }
  return cell.text;
}

function cellText(cell: Cell) {
  const value = sourceCellValue(cell);
  return value === null ? "" : String(value).replaceAll("\u00a0", " ").trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFKC")
    .replaceAll("\u00a0", " ")
    .trim()
    .replace(WHITESPACE_PATTERN, " ")
    .toLocaleLowerCase("es-CO");
}

function buildHeaderMap(sheet: Worksheet, rowNumber: number) {
  const headers = new Map<string, number>();
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const header = normalizeHeader(sheet.getCell(rowNumber, column).text);
    if (header && !headers.has(header)) {
      headers.set(header, column);
    }
  }
  return headers;
}

function findHeaderRow(sheet: Worksheet) {
  const normalizedRequired = REQUIRED_HEADERS.map(normalizeHeader);
  const lastCandidateRow = Math.min(sheet.rowCount, 10);
  for (let rowNumber = 1; rowNumber <= lastCandidateRow; rowNumber += 1) {
    const headers = buildHeaderMap(sheet, rowNumber);
    if (normalizedRequired.every((header) => headers.has(header))) {
      return { headers, rowNumber };
    }
  }
  throw new ProductImportFileError(
    "invalid_program_one_headers",
    "El archivo no contiene los encabezados esperados de Programa 1."
  );
}

function readText(
  cell: Cell,
  field: string,
  issues: ProductImportIssue[],
  options: { required?: boolean } = {}
) {
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return "";
  }
  const value = cellText(cell);
  if (!value && options.required) {
    addIssue(issues, "required", field, "Este campo es obligatorio.");
  }
  return value;
}

function parseGroupedNumber(value: string) {
  const compact = value.replace(WHITESPACE_PATTERN, "");
  if (!GROUPED_NUMBER_PATTERN.test(compact)) {
    return null;
  }
  const parsed = Number(compact.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readMoney(
  cell: Cell,
  field: "cost" | "price",
  issues: ProductImportIssue[]
) {
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return 0;
  }
  const raw = sourceCellValue(cell);
  const value =
    typeof raw === "number"
      ? raw
      : parseGroupedNumber(cellText(cell).replace(CURRENCY_PREFIX_PATTERN, ""));
  if (value === null || !Number.isFinite(value)) {
    addIssue(
      issues,
      "invalid_money",
      field,
      "El valor monetario no tiene el formato esperado."
    );
    return 0;
  }
  return value;
}

function readStock(cell: Cell, issues: ProductImportIssue[]) {
  const field = "initialStock";
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return 0;
  }
  const raw = sourceCellValue(cell);
  const value =
    typeof raw === "number"
      ? raw
      : parseGroupedNumber(
          cellText(cell).replace(STOCK_UNIT_SUFFIX_PATTERN, "").trim()
        );
  if (value === null || !Number.isFinite(value)) {
    addIssue(
      issues,
      "invalid_stock",
      field,
      'El inventario debe tener un valor como "25 Unidad".'
    );
    return 0;
  }
  return value;
}

function readTaxRate(cell: Cell, issues: ProductImportIssue[]) {
  const field = "taxRate";
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return 0;
  }
  const value = cellText(cell).toLocaleLowerCase("es-CO");
  if (!value || value === "no responsable" || value === "exento") {
    return 0;
  }
  const percentage = value.match(PERCENTAGE_PATTERN);
  const parsed = parseGroupedNumber(
    (percentage?.[1] ?? value).replace(",", ".")
  );
  if (parsed === null) {
    addIssue(
      issues,
      "invalid_tax",
      field,
      "El impuesto de Programa 1 no es reconocido."
    );
    return 0;
  }
  return parsed;
}

function readSku(cell: Cell, issues: ProductImportIssue[]) {
  const field = "sku";
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return null;
  }
  if (
    typeof cell.value === "number" &&
    !(Number.isSafeInteger(cell.value) && Number.isInteger(cell.value))
  ) {
    addIssue(
      issues,
      "unsafe_identifier_precision",
      field,
      "Excel convirtió este código a un número sin precisión. Exporta y usa el archivo CSV para conservarlo exactamente."
    );
    return null;
  }
  return cellText(cell) || null;
}

function sourceDataForRow(
  sheet: Worksheet,
  rowNumber: number,
  headers: Map<string, number>
) {
  return Object.fromEntries(
    PROGRAM_ONE_HEADERS.map((header) => {
      const column = headers.get(normalizeHeader(header));
      return [
        header,
        column ? sourceCellValue(sheet.getCell(rowNumber, column)) : null,
      ];
    })
  );
}

function isExportFooter(productName: string) {
  const value = normalizeHeader(productName);
  return (
    value.includes("adicionar a sucursal") &&
    value.includes("retirar de sucursal") &&
    value.includes("sincronizar tienda virtual")
  );
}

function parseProductRow(
  source: ProgramOneSheet,
  rowNumber: number,
  headers: Map<string, number>
) {
  const cell = (header: ProgramOneHeader) => {
    const column = headers.get(normalizeHeader(header));
    if (!column) {
      throw new ProductImportFileError(
        "invalid_program_one_headers",
        `Falta el encabezado ${header} en el archivo de Programa 1.`
      );
    }
    return source.sheet.getCell(rowNumber, column);
  };
  const issues: ProductImportIssue[] = [];
  const name = readText(cell("Producto"), "name", issues, { required: true });
  const productType = readText(
    cell("Tipo de producto"),
    "productType",
    issues,
    { required: true }
  );
  if (
    productType &&
    normalizeHeader(productType) !== normalizeHeader("Sencillo")
  ) {
    addIssue(
      issues,
      "unsupported_product_type",
      "productType",
      `El tipo de producto "${productType}" no está soportado en esta versión.`
    );
  }

  const candidate = {
    name,
    categoryName: readText(cell("Categoría"), "categoryName", issues) || null,
    sku: readSku(cell("SKU/Código"), issues),
    barcode: null,
    price: readMoney(cell("Precio venta"), "price", issues),
    cost: readMoney(cell("Precio compra"), "cost", issues),
    taxRate: readTaxRate(cell("Impuesto"), issues),
    initialStock: readStock(cell("Inventario actual"), issues),
    minStock: null,
    reorderQuantity: null,
    trackInventory: true,
    isModifier: false,
    isIngredient: false,
    accountingTreatment: "revenue" as const,
    autoPayoutEnabled: false,
    autoPayoutPaymentMethod: "cash",
  };

  if (issues.length > 0) {
    return {
      rowNumber,
      sourceReference: `${source.label}!${rowNumber}`,
      sourceData: sourceDataForRow(source.sheet, rowNumber, headers),
      normalizedData: null,
      issues,
    };
  }

  const normalized = normalizeProductImportCandidate(candidate);
  return {
    rowNumber,
    sourceReference: `${source.label}!${rowNumber}`,
    sourceData: sourceDataForRow(source.sheet, rowNumber, headers),
    normalizedData: normalized.product,
    issues: normalized.issues,
  };
}

function parseProgramOneSheet(source: ProgramOneSheet): ParsedProductImport {
  const { headers, rowNumber: headerRow } = findHeaderRow(source.sheet);
  const productColumn = headers.get(normalizeHeader("Producto"));
  if (!productColumn) {
    throw new ProductImportFileError(
      "invalid_program_one_headers",
      "Falta el encabezado Producto en el archivo de Programa 1."
    );
  }

  const rowNumbers: number[] = [];
  for (
    let rowNumber = headerRow + 1;
    rowNumber <= source.sheet.rowCount;
    rowNumber += 1
  ) {
    const productName = cellText(
      source.sheet.getCell(rowNumber, productColumn)
    );
    const hasProductData = REQUIRED_HEADERS.some((header) => {
      const column = headers.get(normalizeHeader(header));
      return column ? cellText(source.sheet.getCell(rowNumber, column)) : false;
    });
    if (hasProductData && !isExportFooter(productName)) {
      rowNumbers.push(rowNumber);
    }
  }

  if (rowNumbers.length === 0) {
    throw new ProductImportFileError(
      "empty_file",
      "El archivo no contiene productos para importar."
    );
  }
  if (rowNumbers.length > PRODUCT_IMPORT_MAX_ROWS) {
    throw new ProductImportFileError(
      "too_many_rows",
      `El archivo supera el máximo de ${PRODUCT_IMPORT_MAX_ROWS} productos.`
    );
  }

  const parsedRows = rowNumbers.map((rowNumber) =>
    parseProductRow(source, rowNumber, headers)
  );
  const products = parsedRows.flatMap((row) =>
    row.normalizedData ? [row.normalizedData] : []
  );
  let productIndex = 0;
  return {
    document: { version: PRODUCT_IMPORT_FORMAT_VERSION, products },
    sourceRows: parsedRows.map((row) => ({
      rowNumber: row.rowNumber,
      sourceReference: row.sourceReference,
      sourceData: row.sourceData,
      issues: row.issues,
      productIndex: row.normalizedData ? productIndex++ : null,
    })),
  };
}

function hasXlsxSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

async function loadProgramOneXlsx(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  try {
    const input = new Uint8Array(bytes.byteLength);
    input.set(bytes);
    await workbook.xlsx.load(input.buffer);
  } catch {
    throw new ProductImportFileError(
      "invalid_xlsx",
      "El archivo no es un libro XLSX válido."
    );
  }
  if (workbook.worksheets.length === 0) {
    throw new ProductImportFileError(
      "missing_worksheet",
      "El libro XLSX no contiene hojas."
    );
  }
  const sheet = workbook.worksheets.find((candidate) => {
    try {
      findHeaderRow(candidate);
      return true;
    } catch {
      return false;
    }
  });
  if (!sheet) {
    throw new ProductImportFileError(
      "invalid_program_one_headers",
      "Ninguna hoja contiene los encabezados esperados de Programa 1."
    );
  }
  return { label: sheet.name, sheet } satisfies ProgramOneSheet;
}

async function loadProgramOneCsv(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  try {
    const input = new Uint8Array(bytes.byteLength);
    input.set(bytes);
    const sheet = await workbook.csv.read(Readable.from([input]), {
      map: (value: unknown) => value,
      sheetName: "CSV",
    });
    return { label: "CSV", sheet } satisfies ProgramOneSheet;
  } catch {
    throw new ProductImportFileError(
      "invalid_csv",
      "El archivo no es un CSV válido."
    );
  }
}

async function parseProgramOneFile(
  bytes: Uint8Array
): Promise<ParsedProductImport> {
  const source = hasXlsxSignature(bytes)
    ? await loadProgramOneXlsx(bytes)
    : await loadProgramOneCsv(bytes);
  return parseProgramOneSheet(source);
}

export const programOneImporter: ProductImporter = {
  key: PROGRAM_ONE_IMPORTER_KEY,
  label: "Programa 1",
  description:
    "Importa la exportación de productos de Programa 1 en formato CSV o XLSX.",
  acceptedExtensions: [".csv", ".xlsx"],
  acceptedMimeTypes: [...CSV_MIME_TYPES, XLSX_MIME_TYPE],
  parse: parseProgramOneFile,
};
