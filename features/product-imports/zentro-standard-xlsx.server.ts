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

export const ZENTRO_STANDARD_IMPORTER_KEY = "zentro-standard-xlsx";
export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ZENTRO_PRODUCT_HEADERS = [
  "nombre",
  "categoria",
  "sku",
  "codigo_barras",
  "precio",
  "costo",
  "impuesto",
  "stock_inicial",
  "stock_minimo",
  "cantidad_reorden",
  "controla_inventario",
  "es_modificador",
  "es_insumo",
  "tratamiento_contable",
  "autosalida_habilitada",
  "metodo_pago_autosalida",
] as const;

type ProductHeader = (typeof ZENTRO_PRODUCT_HEADERS)[number];

const HEADER_TO_FIELD: Record<ProductHeader, string> = {
  nombre: "name",
  categoria: "categoryName",
  sku: "sku",
  codigo_barras: "barcode",
  precio: "price",
  costo: "cost",
  impuesto: "taxRate",
  stock_inicial: "initialStock",
  stock_minimo: "minStock",
  cantidad_reorden: "reorderQuantity",
  controla_inventario: "trackInventory",
  es_modificador: "isModifier",
  es_insumo: "isIngredient",
  tratamiento_contable: "accountingTreatment",
  autosalida_habilitada: "autoPayoutEnabled",
  metodo_pago_autosalida: "autoPayoutPaymentMethod",
};

const COLORS = {
  brand: "FFFF5A36",
  brandDark: "FF9A3412",
  header: "FF111827",
  white: "FFFFFFFF",
  muted: "FF6B7280",
  soft: "FFFFF7ED",
} as const;

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
  return value === null ? "" : String(value).trim();
}

function addIssue(
  issues: ProductImportIssue[],
  code: string,
  field: string,
  message: string
) {
  issues.push({ code, field, message });
}

function readString(
  cell: Cell,
  field: string,
  issues: ProductImportIssue[],
  options: { defaultValue?: string; required?: boolean } = {}
) {
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return options.defaultValue ?? "";
  }
  const value = cellText(cell);
  if (!value && options.required) {
    addIssue(issues, "required", field, "Este campo es obligatorio.");
  }
  return value || options.defaultValue || "";
}

function readNumber(
  cell: Cell,
  field: string,
  issues: ProductImportIssue[],
  options: {
    allowNull?: boolean;
    defaultValue?: number;
    required?: boolean;
  } = {}
) {
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return options.allowNull ? null : (options.defaultValue ?? 0);
  }
  const raw = sourceCellValue(cell);
  if (raw === null || String(raw).trim() === "") {
    if (options.required) {
      addIssue(issues, "required", field, "Este campo es obligatorio.");
    }
    return options.allowNull ? null : (options.defaultValue ?? 0);
  }
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    addIssue(issues, "invalid_number", field, "Debe ser un número válido.");
    return options.allowNull ? null : (options.defaultValue ?? 0);
  }
  return value;
}

function readBoolean(
  cell: Cell,
  field: string,
  issues: ProductImportIssue[],
  defaultValue: boolean
) {
  if (isFormulaCell(cell)) {
    addIssue(
      issues,
      "formula_not_allowed",
      field,
      "Las fórmulas no están permitidas en archivos de importación."
    );
    return defaultValue;
  }
  const value = cellText(cell).toLocaleLowerCase("es-CO");
  if (!value) {
    return defaultValue;
  }
  if (["1", "si", "sí", "true", "yes"].includes(value)) {
    return true;
  }
  if (["0", "no", "false"].includes(value)) {
    return false;
  }
  addIssue(issues, "invalid_boolean", field, 'Usa "SI" o "NO".');
  return defaultValue;
}

function isBlankProductRow(sheet: Worksheet, rowNumber: number) {
  return ZENTRO_PRODUCT_HEADERS.every(
    (_header, index) => !cellText(sheet.getCell(rowNumber, index + 1))
  );
}

function parseProductRow(sheet: Worksheet, rowNumber: number) {
  const sourceData = Object.fromEntries(
    ZENTRO_PRODUCT_HEADERS.map((header, index) => [
      header,
      sourceCellValue(sheet.getCell(rowNumber, index + 1)),
    ])
  );
  const issues: ProductImportIssue[] = [];
  const cell = (header: ProductHeader) =>
    sheet.getCell(rowNumber, ZENTRO_PRODUCT_HEADERS.indexOf(header) + 1);
  const accountingTreatment = readString(
    cell("tratamiento_contable"),
    "accountingTreatment",
    issues,
    { defaultValue: "revenue" }
  ).toLowerCase();
  if (!["revenue", "passthrough"].includes(accountingTreatment)) {
    addIssue(
      issues,
      "invalid_accounting_treatment",
      "accountingTreatment",
      'Usa "revenue" o "passthrough".'
    );
  }

  const candidate = {
    name: readString(cell("nombre"), "name", issues, { required: true }),
    categoryName: readString(cell("categoria"), "categoryName", issues) || null,
    sku: readString(cell("sku"), "sku", issues) || null,
    barcode: readString(cell("codigo_barras"), "barcode", issues) || null,
    price: readNumber(cell("precio"), "price", issues, { required: true }),
    cost: readNumber(cell("costo"), "cost", issues, { defaultValue: 0 }),
    taxRate: readNumber(cell("impuesto"), "taxRate", issues, {
      defaultValue: 0,
    }),
    initialStock: readNumber(cell("stock_inicial"), "initialStock", issues, {
      defaultValue: 0,
    }),
    minStock: readNumber(cell("stock_minimo"), "minStock", issues, {
      allowNull: true,
    }),
    reorderQuantity: readNumber(
      cell("cantidad_reorden"),
      "reorderQuantity",
      issues,
      { allowNull: true }
    ),
    trackInventory: readBoolean(
      cell("controla_inventario"),
      "trackInventory",
      issues,
      true
    ),
    isModifier: readBoolean(
      cell("es_modificador"),
      "isModifier",
      issues,
      false
    ),
    isIngredient: readBoolean(cell("es_insumo"), "isIngredient", issues, false),
    accountingTreatment,
    autoPayoutEnabled: readBoolean(
      cell("autosalida_habilitada"),
      "autoPayoutEnabled",
      issues,
      false
    ),
    autoPayoutPaymentMethod: readString(
      cell("metodo_pago_autosalida"),
      "autoPayoutPaymentMethod",
      issues,
      { defaultValue: "cash" }
    ),
  };

  if (issues.length > 0) {
    return {
      rowNumber,
      sourceReference: `Productos!${rowNumber}`,
      sourceData,
      normalizedData: null,
      issues,
    };
  }

  const normalized = normalizeProductImportCandidate(candidate);
  return {
    rowNumber,
    sourceReference: `Productos!${rowNumber}`,
    sourceData,
    normalizedData: normalized.product,
    issues: normalized.issues,
  };
}

async function parseZentroStandardWorkbook(
  bytes: Uint8Array
): Promise<ParsedProductImport> {
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

  const metadata = workbook.getWorksheet("_zentro");
  const version = metadata?.getCell("B1").text.trim();
  if (
    metadata?.getCell("A1").text.trim() !== "format_version" ||
    version !== PRODUCT_IMPORT_FORMAT_VERSION
  ) {
    throw new ProductImportFileError(
      "unsupported_version",
      `El archivo debe usar la versión ${PRODUCT_IMPORT_FORMAT_VERSION} del formato estándar de Zentro.`
    );
  }

  const products = workbook.getWorksheet("Productos");
  if (!products) {
    throw new ProductImportFileError(
      "missing_products_sheet",
      'El archivo debe incluir la hoja "Productos".'
    );
  }

  const receivedHeaders = ZENTRO_PRODUCT_HEADERS.map((_header, index) =>
    products.getCell(1, index + 1).text.trim()
  );
  const headersMatch = ZENTRO_PRODUCT_HEADERS.every(
    (header, index) => receivedHeaders[index] === header
  );
  if (!headersMatch) {
    throw new ProductImportFileError(
      "invalid_headers",
      "Los encabezados de la hoja Productos no corresponden al formato estándar de Zentro."
    );
  }

  const rowNumbers: number[] = [];
  for (let rowNumber = 2; rowNumber <= products.rowCount; rowNumber += 1) {
    if (!isBlankProductRow(products, rowNumber)) {
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
    parseProductRow(products, rowNumber)
  );
  const canonicalProducts = parsedRows.flatMap((row) =>
    row.normalizedData ? [row.normalizedData] : []
  );
  let productIndex = 0;
  return {
    document: {
      version: PRODUCT_IMPORT_FORMAT_VERSION,
      products: canonicalProducts,
    },
    sourceRows: parsedRows.map((row) => {
      const currentProductIndex = row.normalizedData ? productIndex++ : null;
      return {
        rowNumber: row.rowNumber,
        sourceReference: row.sourceReference,
        sourceData: row.sourceData,
        issues: row.issues,
        productIndex: currentProductIndex,
      };
    }),
  };
}

function styleHeader(sheet: Worksheet) {
  const header = sheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: COLORS.white } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.header },
  };
  header.alignment = { vertical: "middle", wrapText: true };
}

function addListValidation(
  sheet: Worksheet,
  column: number,
  formula: string,
  prompt: string
) {
  for (let row = 2; row <= PRODUCT_IMPORT_MAX_ROWS + 1; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Valor no válido",
      error: "Selecciona un valor de la lista.",
      showInputMessage: true,
      promptTitle: "Formato Zentro",
      prompt,
    };
  }
}

async function buildZentroStandardTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zentro";
  workbook.lastModifiedBy = "Zentro";
  workbook.created = new Date();
  workbook.modified = new Date();

  const instructions = workbook.addWorksheet("Instrucciones", {
    properties: { tabColor: { argb: COLORS.brand } },
  });
  instructions.columns = [{ width: 28 }, { width: 88 }];
  instructions.mergeCells("A1:B1");
  instructions.getCell("A1").value = "Importación estándar de productos Zentro";
  instructions.getCell("A1").font = {
    bold: true,
    size: 20,
    color: { argb: COLORS.brandDark },
  };
  instructions.getRow(1).height = 34;
  const guidance = [
    ["Versión", PRODUCT_IMPORT_FORMAT_VERSION],
    ["Uso", 'Completa una fila por producto en la hoja "Productos".'],
    ["Obligatorios", "nombre y precio"],
    ["Dinero", "Valores enteros en pesos colombianos, sin símbolos."],
    [
      "Booleanos",
      'Usa "SI" o "NO". Las celdas vacías usan el valor predeterminado.',
    ],
    ["Categorías", "Las categorías que no existan se crearán al confirmar."],
    ["Inventario", "stock_inicial debe ser 0 si controla_inventario es NO."],
    [
      "Insumos",
      "es_insumo=SI fuerza precio 0, revenue y desactiva modificador/autosalida.",
    ],
    [
      "No contables",
      "passthrough desactiva inventario y modificador; puede habilitar autosalida.",
    ],
    [
      "Límite",
      `Máximo ${PRODUCT_IMPORT_MAX_ROWS} productos y 5 MiB por archivo.`,
    ],
    ["Fórmulas", "No se permiten fórmulas; pega valores."],
  ];
  for (const [label, description] of guidance) {
    const row = instructions.addRow([label, description]);
    row.getCell(1).font = { bold: true, color: { argb: COLORS.header } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const products = workbook.addWorksheet("Productos", {
    properties: { tabColor: { argb: COLORS.brandDark } },
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const widths = [
    32, 24, 18, 22, 16, 16, 14, 16, 16, 20, 20, 18, 14, 24, 22, 28,
  ];
  products.columns = ZENTRO_PRODUCT_HEADERS.map((header, index) => ({
    header,
    key: HEADER_TO_FIELD[header],
    width: widths[index],
  }));
  styleHeader(products);
  products.autoFilter = {
    from: "A1",
    to: `${products.getColumn(ZENTRO_PRODUCT_HEADERS.length).letter}1`,
  };
  products.getColumn(3).numFmt = "@";
  products.getColumn(4).numFmt = "@";
  for (const column of [5, 6, 8, 9, 10]) {
    products.getColumn(column).numFmt = "#,##0";
  }
  products.getColumn(7).numFmt = "0";
  for (let column = 1; column <= ZENTRO_PRODUCT_HEADERS.length; column += 1) {
    products.getCell(1, column).note =
      `Campo ${HEADER_TO_FIELD[ZENTRO_PRODUCT_HEADERS[column - 1]]}`;
  }

  const lists = workbook.addWorksheet("_catalogos");
  lists.state = "veryHidden";
  lists.getCell("A1").value = "booleanos";
  lists.getCell("A2").value = "SI";
  lists.getCell("A3").value = "NO";
  lists.getCell("B1").value = "tratamientos";
  lists.getCell("B2").value = "revenue";
  lists.getCell("B3").value = "passthrough";
  for (const column of [11, 12, 13, 15]) {
    addListValidation(
      products,
      column,
      "'_catalogos'!$A$2:$A$3",
      'Selecciona "SI" o "NO".'
    );
  }
  addListValidation(
    products,
    14,
    "'_catalogos'!$B$2:$B$3",
    "Selecciona el tratamiento contable."
  );

  const metadata = workbook.addWorksheet("_zentro");
  metadata.state = "veryHidden";
  metadata.getCell("A1").value = "format_version";
  metadata.getCell("B1").value = PRODUCT_IMPORT_FORMAT_VERSION;
  metadata.getCell("A2").value = "importer_key";
  metadata.getCell("B2").value = ZENTRO_STANDARD_IMPORTER_KEY;

  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes);
}

export const zentroStandardXlsxImporter: ProductImporter = {
  key: ZENTRO_STANDARD_IMPORTER_KEY,
  label: "Formato estándar de Zentro (XLSX)",
  description:
    "Plantilla versionada para importar el catálogo completo de productos.",
  acceptedExtensions: [".xlsx"],
  acceptedMimeTypes: [XLSX_MIME_TYPE],
  parse: parseZentroStandardWorkbook,
  template: {
    build: buildZentroStandardTemplate,
    fileName: "plantilla-importacion-productos-zentro-v1.xlsx",
    mimeType: XLSX_MIME_TYPE,
  },
};
