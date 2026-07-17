---
name: exceljs
description: Create, edit, read, and verify professional Excel workbooks with the maintained @protobi/exceljs fork. Use for .xlsx or .csv generation and transformation, reports, exports, import templates, formulas, styling, tables, filters, validations, conditional formatting, images, print layouts, protection, large-file streaming, fork-specific pivot tables or form-control checkboxes, and safe round-tripping of existing workbooks with pivots or charts.
---

# ExcelJS workbooks

Use `@protobi/exceljs`, not the unscoped `exceljs` package, unless the target repository explicitly standardizes on upstream. Treat a workbook as a deliverable that must be structurally valid, visually usable, and verified after serialization.

## Execute the workflow

1. Determine the output path, workbook purpose, target viewer, locale/timezone, input data shape, expected formulas, and scale. Infer conventional choices when requirements already make them clear.
2. Inspect the target project before adding dependencies. Match its package manager and module system. Install `@protobi/exceljs` only when dependency changes are within scope; use an isolated temporary project for one-off artifact generation.
3. Choose the document API by default. Choose the streaming API only for large row counts when its feature restrictions are acceptable.
4. Model worksheets before coding: stable sheet names, column order and types, formulas, validations, navigation, print behavior, and relationships between raw-data and summary sheets.
5. Generate or modify the workbook. Use real `Date` and numeric values; use `numFmt` for display. Keep formulas in English with comma separators and provide cached `result` values when known.
6. Write the `.xlsx`, reopen it, and validate sheet names, dimensions, formulas, tables, merges, validations, drawings, and pivot parts. Run `scripts/inspect_xlsx.py` for independent OOXML inspection.
7. Render or open the workbook in Excel, LibreOffice, or another target viewer when visual layout matters. Iterate on clipping, column widths, row heights, wrapping, print areas, and contrast.
8. Deliver the workbook as a clickable file link and briefly state what was verified.

## Start from a reliable skeleton

Copy `assets/report-template.ts` into the target project when a polished tabular report is a useful starting point. Adapt it rather than forcing a unique workbook into a generic abstraction.

For a small workbook, use this shape:

```ts
import ExcelJS from "@protobi/exceljs";

const workbook = new ExcelJS.Workbook();
workbook.creator = "Zentro";
workbook.calcProperties.fullCalcOnLoad = true;

const sheet = workbook.addWorksheet("Report", {
  views: [{ state: "frozen", ySplit: 1 }],
});
sheet.columns = [
  { header: "Date", key: "date", width: 14 },
  { header: "Description", key: "description", width: 36 },
  { header: "Amount", key: "amount", width: 16 },
];
sheet.addRows(data);
sheet.getColumn("date").numFmt = "yyyy-mm-dd";
sheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
sheet.autoFilter = `A1:C${sheet.rowCount}`;

await workbook.xlsx.writeFile(outputPath);
```

## Select document or streaming mode

Use the standard `new ExcelJS.Workbook()` API whenever the workbook needs images, pivot tables, arbitrary edits, unmerge operations, full in-memory inspection, or cross-row logic.

Use `new ExcelJS.stream.xlsx.WorkbookWriter(...)` for very large sequential exports. Commit each row, each worksheet, then the workbook. Do not use streaming mode for pivot tables or images. Read [streaming-and-performance.md](references/streaming-and-performance.md) before selecting it.

## Apply the quality bar

- Preserve exact source data and business semantics. Never turn numeric values into decorated strings such as `"$1,200"`.
- Use readable titles and headers, frozen panes for long tables, filters or Excel tables for exploration, and sensible widths with wrapped long text.
- Use ARGB colors with eight hexadecimal digits, such as `FF2563EB`.
- Use locale-neutral stored values. Apply number/date formats for presentation.
- Avoid merged cells inside sortable/filterable data regions. Reserve merges for titles or presentation blocks.
- Escape formula-like untrusted text by storing it as text when importing CSV/user content; values beginning with `=`, `+`, `-`, or `@` can trigger spreadsheet formulas.
- Keep worksheet names at most 31 characters and exclude `[]:*?/\\`. Ensure names are unique.
- Set print areas, repeating header rows, margins, orientation, and fit-to-width for printable reports.
- Keep raw data in a normalized sheet and summaries in separate sheets when the workbook combines analysis with auditability.
- Do not rely on ExcelJS to calculate formulas. Supply cached results when available and set `fullCalcOnLoad` when Excel should recalculate.

## Modify existing workbooks safely

Load with `await workbook.xlsx.readFile(path)`, make the smallest required changes, write to a new path first, and inspect the result. Do not use `ignoreNodes` for features that must survive round-trip. The Protobi fork preserves existing pivot/chart XML, but does not expose existing pivot definitions for programmatic editing. Do not mix preserved pivots with newly created pivots without explicit fixture testing.

## Load only the needed references

- Read [installation-and-runtime.md](references/installation-and-runtime.md) for package selection, imports, Bun/Node/browser use, TypeScript gaps, and fork version checks.
- Read [cells-and-data.md](references/cells-and-data.md) for worksheets, rows, columns, value types, formulas, names, comments, and editing operations.
- Read [styling-layout-and-printing.md](references/styling-layout-and-printing.md) for styles, number formats, widths, views, images, and print setup.
- Read [tables-validation-and-protection.md](references/tables-validation-and-protection.md) for tables, filters, data validation, conditional formatting, outlines, and sheet protection.
- Read [advanced-fork-features.md](references/advanced-fork-features.md) for pivot tables, `count`, report filters, form-control checkboxes, and round-trip preservation.
- Read [streaming-and-performance.md](references/streaming-and-performance.md) for high-volume reading/writing and memory tradeoffs.
- Read [recipes.md](references/recipes.md) for report, invoice, import-template, dashboard, and workbook-editing patterns.
- Read [quality-assurance.md](references/quality-assurance.md) for structural, semantic, visual, and compatibility verification.

## Use bundled resources

- Run `python3 scripts/inspect_xlsx.py <file.xlsx> --json` after generation. Use `--require-sheet NAME` repeatedly for contractual sheet names.
- Copy `assets/report-template.ts` as an editable production-quality starting point.
- Copy `assets/protobi-exceljs-extensions.d.ts` when TypeScript needs fork-only declarations for pivots and form checkboxes. Keep it until the package publishes equivalent types.
