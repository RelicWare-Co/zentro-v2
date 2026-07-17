import ExcelJS from "@protobi/exceljs";
import {
  formatReportMovementType,
  formatReportSaleFilterStatus,
  formatReportSaleStatus,
} from "@/features/reports/report-labels.shared";
import type { ReportData } from "@/features/reports/reports.schema";

const COLORS = {
  brand: "FFFF5A36",
  brandDark: "FF9A3412",
  headerText: "FFFFFFFF",
  muted: "FF71717A",
} as const;

const MONEY_FORMAT = '"$" #,##0;[Red]-"$" #,##0';
const INTEGER_FORMAT = "#,##0;[Red]-#,##0";
const DATE_TIME_FORMAT = "yyyy-mm-dd hh:mm";

type Worksheet = ExcelJS.Worksheet;

function toExcelWallClockDate(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return new Date(
    Date.UTC(
      values.year ?? 1970,
      (values.month ?? 1) - 1,
      values.day ?? 1,
      values.hour ?? 0,
      values.minute ?? 0,
      values.second ?? 0
    )
  );
}

function styleTitle(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  width: number
) {
  sheet.mergeCells(1, 1, 1, width);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "Aptos Display",
    size: 20,
    bold: true,
    color: { argb: COLORS.brandDark },
  };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, width);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, color: { argb: COLORS.muted } };
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 26;
  row.font = { bold: true, color: { argb: COLORS.headerText } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.brandDark },
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

function setPrintLayout(sheet: Worksheet, width: number, lastRow: number) {
  const endColumn = sheet.getColumn(width).letter;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${endColumn}${Math.max(lastRow, 3)}`,
    printTitlesRow: "1:4",
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.6,
      bottom: 0.6,
      header: 0.2,
      footer: 0.2,
    },
  };
  sheet.headerFooter.oddFooter = "&LZentro&C&F&RPage &P de &N";
}

function addTableOrHeaders(
  sheet: Worksheet,
  name: string,
  headers: string[],
  rows: (Date | number | string | null)[][]
) {
  if (rows.length > 0) {
    sheet.addTable({
      name,
      ref: "A4",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((header) => ({ name: header })),
      rows,
    });
  } else {
    sheet.getRow(4).values = headers;
    sheet.autoFilter = `A4:${sheet.getColumn(headers.length).letter}4`;
  }
  styleHeader(sheet.getRow(4));
}

function addSummarySheet(workbook: ExcelJS.Workbook, report: ReportData) {
  const sheet = workbook.addWorksheet("Resumen", {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ state: "frozen", ySplit: 7, activeCell: "A8" }],
  });
  sheet.columns = [{ width: 28 }, { width: 20 }, { width: 28 }, { width: 20 }];
  styleTitle(
    sheet,
    `Reporte de negocio - ${report.organizationName}`,
    `${report.period.startDate} a ${report.period.endDate} | ${report.timeZone}`,
    4
  );
  sheet.getCell("A3").value = "Cajero";
  sheet.getCell("B3").value = report.filters.cashierName ?? "Todos";
  sheet.getCell("C3").value = "Estado";
  sheet.getCell("D3").value = formatReportSaleFilterStatus(
    report.filters.status
  );
  sheet.getCell("A4").value = "Generado";
  sheet.getCell("B4").value = toExcelWallClockDate(
    report.generatedAt,
    report.timeZone
  );
  sheet.getCell("B4").numFmt = DATE_TIME_FORMAT;
  sheet.getCell("C4").value = "Moneda";
  sheet.getCell("D4").value = "COP";

  const metrics: [string, number, string, number][] = [
    [
      "Ventas",
      report.summary.salesCount,
      "Facturación contable",
      report.summary.grossSales,
    ],
    [
      "Ingreso neto sin impuesto",
      report.summary.netRevenue,
      "Impuestos",
      report.summary.taxCollected,
    ],
    [
      "Descuentos",
      report.summary.discounts,
      "Ticket promedio",
      report.summary.averageTicket,
    ],
    [
      "Recaudo neto",
      report.summary.collectedTotal,
      "Gastos operativos",
      report.summary.expensesTotal,
    ],
    [
      "Pagos a proveedores",
      report.summary.payoutsTotal,
      "Ingresos manuales",
      report.summary.inflowsTotal,
    ],
  ];
  sheet.getRow(6).values = ["Indicador", "Valor", "Indicador", "Valor"];
  styleHeader(sheet.getRow(6));
  for (const [index, metric] of metrics.entries()) {
    const row = sheet.getRow(7 + index);
    row.values = metric;
    row.getCell(2).numFmt = index === 0 ? INTEGER_FORMAT : MONEY_FORMAT;
    row.getCell(4).numFmt = MONEY_FORMAT;
  }

  const trendHeaderRow = 13;
  sheet.getRow(trendHeaderRow).values = [
    "Fecha",
    "Ventas",
    "Facturación contable",
    "Ingreso neto",
  ];
  styleHeader(sheet.getRow(trendHeaderRow));
  for (const [index, point] of report.trend.entries()) {
    const row = sheet.getRow(trendHeaderRow + index + 1);
    row.values = [
      new Date(`${point.dateKey}T00:00:00Z`),
      point.salesCount,
      point.grossSales,
      point.netRevenue,
    ];
    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(2).numFmt = INTEGER_FORMAT;
    row.getCell(3).numFmt = MONEY_FORMAT;
    row.getCell(4).numFmt = MONEY_FORMAT;
  }
  sheet.autoFilter = `A${trendHeaderRow}:D${Math.max(trendHeaderRow, trendHeaderRow + report.trend.length)}`;
  setPrintLayout(sheet, 4, trendHeaderRow + report.trend.length);
}

function addSalesSheet(workbook: ExcelJS.Workbook, report: ReportData) {
  const sheet = workbook.addWorksheet("Ventas", {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
  });
  sheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 24 },
    { width: 20 },
    { width: 26 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  styleTitle(
    sheet,
    "Detalle de ventas",
    `${report.period.startDate} a ${report.period.endDate}`,
    11
  );
  const headers = [
    "Fecha",
    "Estado",
    "Cajero",
    "Terminal",
    "Cliente",
    "Subtotal",
    "Descuento",
    "Impuesto",
    "Total cobrado",
    "Facturación contable",
    "Ingreso neto",
  ];
  addTableOrHeaders(
    sheet,
    "SalesData",
    headers,
    report.sales.map((row) => [
      toExcelWallClockDate(row.createdAt, report.timeZone),
      formatReportSaleStatus(row.status),
      row.cashierName,
      row.terminalName,
      row.customerName,
      row.subtotal,
      row.discountAmount,
      row.taxAmount,
      row.totalAmount,
      row.accountingBilled,
      row.netRevenue,
    ])
  );
  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getCell(rowIndex, 1).numFmt = DATE_TIME_FORMAT;
    for (let column = 6; column <= 11; column += 1) {
      sheet.getCell(rowIndex, column).numFmt = MONEY_FORMAT;
    }
  }
  setPrintLayout(sheet, 11, sheet.rowCount);
}

function addProductsSheet(workbook: ExcelJS.Workbook, report: ReportData) {
  const sheet = workbook.addWorksheet("Productos", {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
  });
  sheet.columns = [
    { width: 34 },
    { width: 24 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
  ];
  styleTitle(
    sheet,
    "Rendimiento de productos",
    "Excluye productos de paso y ventas fuera del filtro",
    7
  );
  addTableOrHeaders(
    sheet,
    "ProductsData",
    [
      "Producto",
      "Categoría",
      "Cantidad",
      "Total facturado",
      "Ingreso neto",
      "Impuesto",
      "Descuento",
    ],
    report.products.map((row) => [
      row.name,
      row.categoryName,
      row.quantitySold,
      row.billedTotal,
      row.netRevenue,
      row.taxAmount,
      row.discountAmount,
    ])
  );
  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getCell(rowIndex, 3).numFmt = INTEGER_FORMAT;
    for (let column = 4; column <= 7; column += 1) {
      sheet.getCell(rowIndex, column).numFmt = MONEY_FORMAT;
    }
  }
  setPrintLayout(sheet, 7, sheet.rowCount);
}

function addPaymentsSheet(workbook: ExcelJS.Workbook, report: ReportData) {
  const sheet = workbook.addWorksheet("Pagos", {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
  });
  sheet.columns = [
    { width: 24 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  styleTitle(
    sheet,
    "Recaudo por medio de pago",
    "El recaudo neto descuenta el cambio entregado",
    6
  );
  addTableOrHeaders(
    sheet,
    "PaymentsData",
    ["Medio", "Pagos", "Entregado", "Cambio", "Aplicado", "Recaudo neto"],
    report.payments.map((row) => [
      row.label,
      row.paymentCount,
      row.tenderedAmount,
      row.changeAmount,
      row.appliedAmount,
      row.netCollected,
    ])
  );
  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getCell(rowIndex, 2).numFmt = INTEGER_FORMAT;
    for (let column = 3; column <= 6; column += 1) {
      sheet.getCell(rowIndex, column).numFmt = MONEY_FORMAT;
    }
  }
  setPrintLayout(sheet, 6, sheet.rowCount);
}

function addMovementsSheet(workbook: ExcelJS.Workbook, report: ReportData) {
  const sheet = workbook.addWorksheet("Movimientos", {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
  });
  sheet.columns = [
    { width: 18 },
    { width: 20 },
    { width: 22 },
    { width: 16 },
    { width: 42 },
    { width: 24 },
    { width: 20 },
    { width: 24 },
  ];
  styleTitle(
    sheet,
    "Movimientos de caja",
    "Gastos, pagos a proveedores e ingresos manuales",
    8
  );
  addTableOrHeaders(
    sheet,
    "MovementsData",
    [
      "Fecha",
      "Tipo",
      "Medio",
      "Monto",
      "Descripción",
      "Cajero",
      "Terminal",
      "Origen",
    ],
    report.movements.map((row) => [
      toExcelWallClockDate(row.createdAt, report.timeZone),
      formatReportMovementType(row.type),
      row.paymentMethodLabel,
      row.amount,
      row.description,
      row.cashierName,
      row.terminalName,
      row.sourceType,
    ])
  );
  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getCell(rowIndex, 1).numFmt = DATE_TIME_FORMAT;
    sheet.getCell(rowIndex, 4).numFmt = MONEY_FORMAT;
    sheet.getCell(rowIndex, 5).alignment = { vertical: "top", wrapText: true };
  }
  setPrintLayout(sheet, 8, sheet.rowCount);
}

export async function buildReportWorkbook(
  report: ReportData
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zentro";
  workbook.lastModifiedBy = "Zentro";
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addSummarySheet(workbook, report);
  addSalesSheet(workbook, report);
  addProductsSheet(workbook, report);
  addPaymentsSheet(workbook, report);
  addMovementsSheet(workbook, report);

  const bytes = await workbook.xlsx.writeBuffer();
  return bytes;
}
