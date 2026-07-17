# Tables, validation, conditional formatting, and protection

## Contents

- Excel tables and filters
- Data validation
- Conditional formatting
- Outlines
- Protection
- Compatibility cautions

## Excel tables and filters

Use an Excel table for a bounded, normalized dataset that benefits from structured filtering, banded rows, and a totals row:

```ts
sheet.addTable({
  name: "SalesTable",
  ref: "A1",
  headerRow: true,
  totalsRow: true,
  style: {
    theme: "TableStyleMedium2",
    showRowStripes: true,
  },
  columns: [
    { name: "Date", filterButton: true, totalsRowLabel: "Total" },
    { name: "Region", filterButton: true },
    { name: "Amount", filterButton: true, totalsRowFunction: "sum" },
  ],
  rows: data.map((item) => [item.date, item.region, item.amount]),
});
```

Table names must be unique, stable identifiers without spaces. Adding a table writes its headers/data into the covered cells and overwrites existing content. Table operations use zero-based indexes and require `table.commit()` after modifications.

Use a worksheet `autoFilter` instead of a table when styling or layout is custom and only filter dropdowns are needed:

```ts
sheet.autoFilter = { from: "A1", to: `H${sheet.rowCount}` };
```

Typically filter only the header range (`A1:H1`); Excel infers the data region. Avoid merged cells in filter ranges.

## Data validation

Create list validation with an inline list for short, stable options:

```ts
sheet.getCell("C2").dataValidation = {
  type: "list",
  allowBlank: false,
  formulae: ['"Draft,Approved,Rejected"'],
  showErrorMessage: true,
  errorStyle: "stop",
  errorTitle: "Invalid status",
  error: "Choose a value from the list.",
  showInputMessage: true,
  promptTitle: "Status",
  prompt: "Select the workflow status.",
};
```

Inline lists are constrained by Excel's validation formula limits and commas inside values. For reusable or long lists, put values on a helper sheet and use an absolute range or defined name:

```ts
sheet.getCell("C2").dataValidation = {
  type: "list",
  formulae: ["'Lists'!$A$2:$A$20"],
};
```

Apply validation per cell across the intended editable range. Support `whole`, `decimal`, `date`, `time`, `textLength`, `custom`, and operators such as `between`, `equal`, and `greaterThan`:

```ts
sheet.getCell("D2").dataValidation = {
  type: "decimal",
  operator: "between",
  allowBlank: false,
  formulae: [0, 1_000_000],
};
```

## Conditional formatting

Add rules through `addConditionalFormatting`:

```ts
sheet.addConditionalFormatting({
  ref: `D2:D${sheet.rowCount}`,
  rules: [
    {
      type: "cellIs",
      operator: "lessThan",
      formulae: [0],
      style: {
        font: { color: { argb: "FF991B1B" } },
        fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" } },
      },
    },
  ],
});
```

Use expression rules for row-level status:

```ts
sheet.addConditionalFormatting({
  ref: `A2:H${sheet.rowCount}`,
  rules: [{
    type: "expression",
    formulae: ['$C2="Overdue"'],
    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFE4E6" } } },
  }],
});
```

Supported families include expression, cell-is, top/bottom, above/below average, color scale, icon set, data bar, contains text, and time period. Some icon sets and custom conditional formats use unsupported extension XML; test the target viewer. Keep rule order and `priority` deterministic when rules overlap.

## Outlines

Group detail rows or columns with outline levels:

```ts
sheet.properties.outlineLevelRow = 1;
for (let rowNumber = 3; rowNumber <= 12; rowNumber += 1) {
  sheet.getRow(rowNumber).outlineLevel = 1;
}
sheet.properties.outlineProperties = {
  summaryBelow: true,
  summaryRight: true,
};
```

Changing outline levels can alter `collapsed` state. Validate the initial open/closed appearance in Excel.

## Protection

Set cell protection flags, then protect the sheet:

```ts
sheet.eachRow((row) => {
  row.eachCell((cell) => {
    cell.protection = { locked: true };
  });
});

for (const address of ["B2", "C2", "D2"]) {
  sheet.getCell(address).protection = { locked: false };
}

await sheet.protect(password, {
  selectLockedCells: true,
  selectUnlockedCells: true,
  autoFilter: true,
  sort: true,
});
```

Worksheet protection is an editing deterrent, not cryptographic security. Do not store secrets in hidden/protected sheets. Keep passwords out of source control and logs.

## Compatibility cautions

- Validate dropdowns, conditional formats, protection permissions, and tables in the target viewer.
- Do not combine tables with merged cells in their range.
- Avoid whole-column conditional formatting on extremely large sheets unless file size and Excel performance are acceptable.
- Do not use table totals cached values as a substitute for business-side verification.
- Keep helper lists and formula dependencies intact when deleting or renaming sheets.
