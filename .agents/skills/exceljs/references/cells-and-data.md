# Worksheets, cells, and data

## Contents

- Workbook and worksheet model
- Rows and columns
- Cell values
- Dates and numbers
- Formulas
- Defined names and links
- Merges, comments, and edits

## Workbook and worksheet model

Set useful metadata and calculation behavior:

```ts
const workbook = new ExcelJS.Workbook();
workbook.creator = "Application name";
workbook.lastModifiedBy = "Application name";
workbook.created = new Date();
workbook.modified = new Date();
workbook.calcProperties.fullCalcOnLoad = true;
```

Create stable, human-readable sheet names. Hide helper sheets with `state: "hidden"`; use `"veryHidden"` only when Excel UI users should not unhide them normally.

```ts
const sheet = workbook.addWorksheet("Orders", {
  properties: { tabColor: { argb: "FF2563EB" } },
  views: [{ state: "frozen", ySplit: 1 }],
});
sheet.state = "visible";
```

Access worksheets by name when IDs may be non-contiguous:

```ts
const orders = workbook.getWorksheet("Orders");
if (!orders) throw new Error("Orders sheet is missing");
```

## Rows and columns

Define keyed columns for object rows:

```ts
sheet.columns = [
  { header: "Order ID", key: "id", width: 14 },
  { header: "Placed", key: "placedAt", width: 14 },
  { header: "Customer", key: "customer", width: 30 },
  { header: "Total", key: "total", width: 16 },
];
sheet.addRow({ id: "SO-1001", placedAt: new Date(), customer: "Ada", total: 125.5 });
sheet.addRows(rows);
```

Column keys are construction conveniences and are not fully persisted in XLSX. Re-establish keys after reading if later code depends on them.

Arrays are 1-based in several ExcelJS APIs: `row.values[1]` is column A and `column.values[1]` is row 1. Prefer `getCell(row, column)` or cell addresses when index ambiguity matters.

Use `eachRow`/`eachCell` for bounded workbook transformations. Avoid repeatedly scanning an entire sheet inside a row loop.

## Cell values

Store native semantic values:

```ts
sheet.getCell("A1").value = null;
sheet.getCell("A2").value = "Text";
sheet.getCell("A3").value = 42.5;
sheet.getCell("A4").value = true;
sheet.getCell("A5").value = new Date("2026-07-17T00:00:00Z");
sheet.getCell("A6").value = { text: "Open", hyperlink: "https://example.com" };
sheet.getCell("A7").value = {
  richText: [
    { text: "Status: " },
    { text: "Paid", font: { bold: true, color: { argb: "FF15803D" } } },
  ],
};
sheet.getCell("A8").value = { error: "#N/A" };
```

Prevent formula injection when exporting untrusted text. If a user-originated string begins with `=`, `+`, `-`, or `@`, validate whether it is intended as a formula. Prefix an apostrophe or otherwise force a text representation when it is not.

## Dates and numbers

Use `Date` for actual dates and numbers for currencies, percentages, durations, and identifiers that truly behave numerically. Use strings for identifiers where leading zeros matter.

```ts
sheet.getColumn("placedAt").numFmt = "yyyy-mm-dd";
sheet.getColumn("total").numFmt = '$#,##0.00;[Red]-$#,##0.00';
sheet.getCell("E2").value = 0.125;
sheet.getCell("E2").numFmt = "0.0%";
```

Construct dates deliberately. `new Date(year, monthIndex, day)` uses local time; ISO timestamps with `Z` use UTC. Decide which semantics the workbook needs before generating values.

## Formulas

ExcelJS serializes formulas but does not evaluate them. Use English function names and commas regardless of the user's Excel UI language.

```ts
sheet.getCell("D2").value = { formula: "B2*C2", result: 125.5 };
sheet.getCell("D10").value = { formula: "SUM(D2:D9)", result: 980 };
```

Use known cached results whenever possible so previews and non-calculating consumers display useful values. Set `workbook.calcProperties.fullCalcOnLoad = true` when Excel should recalculate on open.

Fill repeated formulas efficiently:

```ts
sheet.fillFormula("D2:D100", "B2*C2", (row) => quantities[row - 2] * prices[row - 2]);
```

Use shared/array formulas only when their Excel semantics are required. Verify the serialized workbook in the target Excel version.

## Defined names and links

Use defined names to make formulas and validations understandable:

```ts
sheet.getCell("B2").name = "TaxRate";
sheet.getCell("D2").value = { formula: "C2*TaxRate", result: 19 };
```

Use internal hyperlinks for workbook navigation:

```ts
sheet.getCell("A1").value = {
  text: "Go to raw data",
  hyperlink: "#'Raw Data'!A1",
};
```

Quote sheet names containing spaces inside formulas and internal links.

## Merges, comments, and edits

Merge title blocks before assigning the master cell's value and style:

```ts
sheet.mergeCells("A1:F1");
sheet.getCell("A1").value = "Monthly Sales";
```

Do not merge within data tables. `spliceRows` and `spliceColumns` can behave unpredictably around moved merged cells; unmerge/rebuild deliberately when restructuring.

Add a simple note:

```ts
sheet.getCell("D2").note = "Amount before tax";
```

Use rich note objects only when formatting, size, margins, or protection are required. Verify notes after round-trip because viewer behavior differs.

When editing existing files, inspect `cell.type`, `cell.value`, `cell.formula`, and `cell.result` before overwriting. Preserve styles by changing `value` alone when appropriate; clone style objects before independent mutation because style objects can be shared by reference.
