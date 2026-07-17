import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "@protobi/exceljs";

interface ReportRow {
  id: string;
  date: Date;
  description: string;
  status: "Draft" | "Approved" | "Rejected";
  amount: number;
}

const rows: ReportRow[] = [
  {
    id: "TX-001",
    date: new Date("2026-07-01T00:00:00Z"),
    description: "Example transaction",
    status: "Approved",
    amount: 1250.5,
  },
  {
    id: "TX-002",
    date: new Date("2026-07-02T00:00:00Z"),
    description: "Replace these rows with real data",
    status: "Draft",
    amount: -80,
  },
];

const colors = {
  brand: "FF1E3A8A",
  brandLight: "FFDBEAFE",
  border: "FFD1D5DB",
  headerText: "FFFFFFFF",
  negative: "FFFEE2E2",
} as const;

const outputPath = path.resolve(process.argv[2] ?? "report.xlsx");
await mkdir(path.dirname(outputPath), { recursive: true });

const workbook = new ExcelJS.Workbook();
workbook.creator = "Zentro";
workbook.lastModifiedBy = "Zentro";
workbook.created = new Date();
workbook.modified = new Date();
workbook.calcProperties.fullCalcOnLoad = true;

const report = workbook.addWorksheet("Report", {
  properties: { tabColor: { argb: colors.brand } },
  views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
});

report.mergeCells("A1:E1");
const title = report.getCell("A1");
title.value = "Transaction Report";
title.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: colors.brand } };
title.alignment = { vertical: "middle", horizontal: "left" };
report.getRow(1).height = 32;

report.mergeCells("A2:E2");
report.getCell("A2").value = `Generated ${new Date().toISOString().slice(0, 10)}`;
report.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

const total = rows.reduce((sum, row) => sum + row.amount, 0);
report.getCell("A3").value = "Total";
report.getCell("A3").font = { bold: true };
report.getCell("B3").value = total;
report.getCell("B3").numFmt = '$#,##0.00;[Red]-$#,##0.00';
report.getCell("B3").font = { bold: true, color: { argb: colors.brand } };

report.columns = [
  { key: "id", width: 14 },
  { key: "date", width: 14 },
  { key: "description", width: 38 },
  { key: "status", width: 16 },
  { key: "amount", width: 16 },
];

report.addTable({
  name: "TransactionTable",
  ref: "A4",
  headerRow: true,
  totalsRow: true,
  style: { theme: "TableStyleMedium2", showRowStripes: true },
  columns: [
    { name: "ID", totalsRowLabel: "Total" },
    { name: "Date" },
    { name: "Description" },
    { name: "Status" },
    { name: "Amount", totalsRowFunction: "sum" },
  ],
  rows: rows.map((row) => [row.id, row.date, row.description, row.status, row.amount]),
});

const header = report.getRow(4);
header.height = 26;
header.font = { bold: true, color: { argb: colors.headerText } };
header.alignment = { vertical: "middle", wrapText: true };

const firstDataRow = 5;
const lastDataRow = firstDataRow + rows.length - 1;
for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
  const row = report.getRow(rowNumber);
  row.getCell(2).numFmt = "yyyy-mm-dd";
  row.getCell(3).alignment = { vertical: "top", wrapText: true };
  row.getCell(5).numFmt = '$#,##0.00;[Red]-$#,##0.00';
  row.getCell(4).dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"Draft,Approved,Rejected"'],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Invalid status",
    error: "Select Draft, Approved, or Rejected.",
  };
}

report.addConditionalFormatting({
  ref: `E${firstDataRow}:E${lastDataRow}`,
  rules: [
    {
      type: "cellIs",
      operator: "lessThan",
      formulae: [0],
      style: {
        font: { color: { argb: "FF991B1B" } },
        fill: { type: "pattern", pattern: "solid", bgColor: { argb: colors.negative } },
      },
    },
  ],
});

report.pageSetup = {
  paperSize: 9,
  orientation: "landscape",
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  printArea: `A1:E${lastDataRow + 1}`,
  printTitlesRow: "1:4",
  margins: { left: 0.35, right: 0.35, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
};
report.headerFooter.oddFooter = "&LConfidential&C&F&RPage &P of &N";

const instructions = workbook.addWorksheet("Instructions", {
  properties: { tabColor: { argb: colors.brandLight } },
});
instructions.columns = [{ width: 24 }, { width: 72 }];
instructions.addRows([
  ["Field", "Guidance"],
  ["ID", "Required stable identifier. Preserve leading zeros by storing IDs as text."],
  ["Date", "Use a real date value, displayed as YYYY-MM-DD."],
  ["Status", "Choose Draft, Approved, or Rejected."],
  ["Amount", "Enter a numeric amount; do not type a currency symbol into the value."],
]);
instructions.getRow(1).font = { bold: true, color: { argb: colors.headerText } };
instructions.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.brand } };
instructions.getColumn(2).alignment = { vertical: "top", wrapText: true };

await workbook.xlsx.writeFile(outputPath);
