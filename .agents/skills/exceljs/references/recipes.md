# Workbook recipes

## Contents

- Tabular report
- Invoice
- Import template
- Dashboard with raw data
- Editing an existing workbook
- CSV conversion

## Tabular report

Use one normalized dataset, a strong header, filters/table, frozen panes, semantic number formats, and explicit print setup. Add a metadata block above the table only when it does not interfere with filtering; otherwise put metadata in a separate `About` sheet.

For formulas, calculate cached results in application code and serialize both formula and result. Verify totals independently before delivery.

## Invoice

Use separate regions for seller/buyer, line items, totals, payment details, and notes. Merge only presentation blocks. Store quantities, unit prices, tax rates, and totals as numbers. Use formulas for line totals and summary totals, but also provide cached results.

Set a fixed print area, repeat the line-item header if the invoice can span pages, and render to PDF to verify page breaks. Add a logo with document mode. Keep machine-readable invoice data in a hidden or separate sheet only if required; never treat hidden cells as secure.

## Import template

Create:

- `Instructions`: purpose, required fields, allowed formats, example values, and error guidance.
- `Import`: exact headers, filters, frozen header row, number formats, validations, and a few example rows if requested.
- `Lists`: validation source values; hide it if users need not edit it.

Use text number format for identifiers with leading zeros. Avoid formulas in import columns unless the downstream importer expects formulas. Protect instruction/formula cells and unlock input cells. Test the saved file with the actual importer when possible.

## Dashboard with raw data

Create `Dashboard`, `Summary`, and `Raw Data` sheets. Keep `Raw Data` normalized and filterable. Put formulas or pivot tables in `Summary`; put presentation-focused KPI blocks and charts in `Dashboard`.

ExcelJS can preserve existing charts but does not provide a general chart-creation API. For new charts, start from an existing template and preserve its chart XML only when the template structure is stable and fixture-tested, or use another tool that explicitly supports chart creation.

Use pivot tables only when interactive Excel analysis is a requirement. For universally viewable static summaries, calculate aggregation in application code and write ordinary cells/tables.

## Editing an existing workbook

```ts
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(inputPath);

const sheet = workbook.getWorksheet("Report");
if (!sheet) throw new Error("Report sheet not found");

sheet.getCell("B2").value = newValue;
await workbook.xlsx.writeFile(outputPath);
```

Write to a new path first. Preserve formulas, styles, names, tables, validations, drawings, comments, and hidden sheets unless the request says otherwise. Inspect the input and output with the bundled OOXML inspector and open both in the target viewer.

For template filling, prefer named cells/ranges over brittle hard-coded addresses when the template owns stable defined names.

## CSV conversion

CSV contains one flat sheet and cannot preserve workbook styles, formulas as formulas, merges, validations, tables, images, or multiple sheets.

```ts
const workbook = new ExcelJS.Workbook();
await workbook.csv.readFile(inputCsv, {
  dateFormats: ["YYYY-MM-DD", "MM/DD/YYYY"],
  map(value, index) {
    if (index === 2) return Number(value);
    return value;
  },
});
await workbook.xlsx.writeFile(outputXlsx);
```

Use CSV `map` functions to parse/format deliberately. Specify delimiter, quoting, encoding, and timezone expectations. Treat CSV formula injection as untrusted-input risk.
