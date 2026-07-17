# Protobi fork features

## Contents

- Fork-specific capabilities
- Pivot table creation
- Pivot report filters and widths
- Pivot constraints
- Form-control checkboxes
- Round-trip preservation
- Fork-specific TypeScript

## Fork-specific capabilities

The `@protobi/exceljs` fork adds or maintains features not available in the same form upstream, including:

- Multiple pivot tables, including multiple pivots from one source sheet.
- Pivot `sum` and `count` metrics.
- Pivot page fields/report filters and default selected values.
- Preservation of existing pivot tables, charts, drawings, cache definitions, cache records, styles, colors, and relationships during read/write round-trips.
- Legacy form-control checkboxes.
- Fixes for XML parsing, dates, comments, row heights, conditional formatting, streaming, and rich-text shared strings.

Verify the installed version before using a recent capability. The README can lag source/tests; treat released source and integration tests as authoritative.

## Pivot table creation

Use the standard document workbook, put normalized source data in a worksheet whose first row contains unique headers, and create pivots on separate sheets:

```ts
const source = workbook.addWorksheet("Data");
source.addRows([
  ["Region", "Product", "Quarter", "Amount", "Status"],
  ["North", "Widget", "Q1", 1200, "Final"],
  ["South", "Gadget", "Q1", 900, "Draft"],
  ["North", "Widget", "Q2", 1500, "Final"],
]);

const pivot = workbook.addWorksheet("By Region");
pivot.addPivotTable({
  sourceSheet: source,
  rows: ["Region"],
  columns: ["Quarter"],
  values: ["Amount"],
  metric: "sum",
});
```

Create a count pivot with `metric: "count"`. Current released source accepts only `"sum"` or `"count"`.

Multiple pivot tables are supported across destination worksheets. Give each destination its own worksheet; pivot placement starts at A1.

## Pivot report filters and widths

Add page fields and defaults:

```ts
pivot.addPivotTable({
  sourceSheet: source,
  rows: ["Region"],
  columns: ["Quarter"],
  values: ["Amount"],
  pages: ["Status"],
  pageDefaults: { Status: "Final" },
  metric: "sum",
  applyWidthHeightFormats: "0",
});
```

Every `pageDefaults` key must appear in `pages`, and page fields cannot also be row, column, or value fields. A missing default value is ignored because no shared-item index can be found.

Use `applyWidthHeightFormats: "0"` to preserve widths assigned to the destination sheet. Use `"1"` or omit the option to allow standard pivot auto-sizing.

## Pivot constraints

- Use the document API; streaming pivot creation is unsupported.
- Use the entire source sheet as the pivot source. Partial source ranges are not supported.
- Put unique, case-sensitive field names in row 1. Refer to them exactly in configuration.
- Provide at least one row field and one column field.
- Provide exactly one value field.
- Use only `sum` or `count` metrics.
- Avoid null/undefined dimensions where possible. Normalize data before creating the pivot.
- Expect case-insensitive deduplication of text dimension values; `"Apple"` and `"apple"` are treated as one shared item and the first occurrence is retained.
- Do not expect calculated fields or configurable pivot styling.
- Open the output in desktop Excel as part of acceptance. OOXML presence alone does not prove the pivot is usable.

## Form-control checkboxes

Create legacy floating checkboxes compatible with older Excel versions and commonly supported by WPS/LibreOffice:

```ts
const checkbox = sheet.addFormCheckbox("B2:D3", {
  checked: false,
  link: "E2",
  text: "Approved",
  noThreeD: true,
  print: false,
});

checkbox.checked = true;
checkbox.text = "Ready";
checkbox.link = "F2";
```

The linked cell receives Excel's TRUE/FALSE state when a user interacts with the control. Use a single address such as `B2` for a default-size control or a range for explicit placement.

Checkbox creation is write-only in current fork behavior. `getFormCheckboxes()` returns controls created in the current in-memory worksheet, but reading existing checkbox controls is not implemented. Validate placement in each required viewer because legacy VML rendering differs.

## Round-trip preservation

The fork preserves raw OOXML for existing pivots/charts and reconstructs the relationships needed to prevent corruption. It does not expose parsed pivot/chart objects for editing.

Use this workflow:

1. Read the existing workbook with the document API.
2. Avoid `ignoreNodes` for `drawing`, table, pivot-related relationships, styles, or other content that must survive.
3. Make changes outside existing pivot/chart structures.
4. Write to a new file.
5. Compare pivot/chart OOXML part counts with `scripts/inspect_xlsx.py`.
6. Open the result in Excel, refresh pivots, and inspect charts.

Do not assume that creating new pivots in a workbook already carrying preserved pivot XML is safe. The fork documents preservation and creation as separate hybrid modes. Require a real fixture test before combining them.

## Fork-specific TypeScript

Copy `assets/protobi-exceljs-extensions.d.ts` into the consuming project. It augments `Worksheet` and `Workbook` with pivot and checkbox APIs. Remove it once the installed package provides matching declarations to avoid duplicate/conflicting definitions.
