# Quality assurance

## Contents

- Verification layers
- Structural inspection
- Semantic checks
- Visual checks
- Round-trip and compatibility
- Delivery checklist

## Verification layers

Verify every non-trivial workbook at four levels:

1. Generation completed without rejected promises or partial output.
2. OOXML package and relationships are structurally present.
3. Reopened workbook values, formulas, and metadata match expectations.
4. Target viewer renders and behaves correctly.

No single layer substitutes for the others.

## Structural inspection

Run:

```bash
python3 scripts/inspect_xlsx.py output.xlsx
python3 scripts/inspect_xlsx.py output.xlsx --json --require-sheet "Report"
```

Check:

- ZIP integrity and required workbook parts.
- Worksheet names, visibility, dimensions, row/cell/formula counts.
- Merges, data validations, conditional formatting, tables, drawings, comments, and hyperlinks.
- Pivot tables, caches, charts, images, and VML/form controls when used.
- Formula cells lacking cached values.

For important transformations, inspect both input and output and compare feature counts. A count match is necessary but not sufficient for semantic preservation.

## Semantic checks

Reopen with ExcelJS and assert contractual cells:

```ts
const check = new ExcelJS.Workbook();
await check.xlsx.readFile(outputPath);
const report = check.getWorksheet("Report");
if (!report) throw new Error("Missing Report sheet");
if (report.getCell("A1").text !== "Monthly Sales") {
  throw new Error("Unexpected report title");
}
```

Independently calculate totals, row counts, date ranges, uniqueness constraints, and formula cached results. Sample boundary values: zero, negative, large number, empty optional field, non-ASCII text, long text, leap date, and leading-zero identifier.

Check formulas for `#REF!`, incorrect ranges, unintended relative references, and English function syntax. ExcelJS does not calculate them, so use application-side expectations or a spreadsheet engine for recalculation tests.

## Visual checks

Open or render each visually important worksheet. Inspect:

- Truncated titles, headers, and long text.
- Incorrect date/currency/percent display.
- Frozen panes and active cell.
- Filter dropdowns and table bounds.
- Contrast, hierarchy, alignment, wrapping, and row heights.
- Image size/aspect ratio and overlay behavior.
- Print orientation, scale, repeating rows, margins, page breaks, headers, and footers.
- Validation prompts, conditional formatting, protected/unlocked cells, pivots, and checkboxes.

LibreOffice headless conversion can provide a useful PDF preview when installed, but desktop Excel remains the acceptance viewer for Excel-specific pivots, controls, and compatibility-sensitive files.

## Round-trip and compatibility

For an existing workbook:

1. Preserve the original.
2. Read and write to a new path without changes as a baseline.
3. Inspect/open the baseline for lost features.
4. Apply the requested edit to another new path.
5. Reinspect and compare.

Test the viewers named by the user. Excel desktop, Excel web, LibreOffice, Apple Numbers, Google Sheets, and WPS do not implement all OOXML features identically.

For pivots/charts, verify that Excel opens without repair warnings, pivot fields remain interactive, refresh works, charts render, and source relationships still point to valid data.

## Delivery checklist

- Confirm the final path and `.xlsx` extension.
- Confirm no temporary or input file was overwritten unexpectedly.
- Confirm required sheet names and order.
- Confirm workbook metadata does not expose sensitive local information.
- Confirm formulas and cached results are intentional.
- Confirm no untrusted text became executable formulas.
- Confirm hidden/protected content contains no secrets.
- Confirm structural inspector success.
- Confirm visual review when layout matters.
- Return a clickable absolute file link and summarize verification.
