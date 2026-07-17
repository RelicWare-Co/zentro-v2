# Styling, layout, and printing

## Contents

- Style model
- Number formats
- Headers and visual hierarchy
- Widths and heights
- Views and navigation
- Images
- Page setup
- Headers and footers

## Style model

Apply styles through `font`, `fill`, `border`, `alignment`, `numFmt`, and `protection`.

```ts
cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
cell.border = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};
```

Use eight-digit ARGB. The first pair is alpha; `FF` is opaque. Reuse immutable style constants, or clone before mutation. ExcelJS intentionally shares assigned style object references.

Apply styles to existing rows/columns, then confirm later-created cells inherit the intended style. Row styles win when a row and column define the same property.

## Number formats

Keep values numeric and use `numFmt`:

```ts
const formats = {
  integer: '#,##0;[Red]-#,##0',
  decimal: '#,##0.00;[Red]-#,##0.00',
  currency: '$#,##0.00;[Red]-$#,##0.00',
  percent: '0.0%',
  date: 'yyyy-mm-dd',
  timestamp: 'yyyy-mm-dd hh:mm',
  text: '@',
} as const;
```

Avoid locale-dependent ambiguous date formats. Use explicit currency codes or symbols that match the requirement.

## Headers and visual hierarchy

Use a restrained hierarchy:

- One title style for the report.
- One table-header style with strong contrast.
- Optional subtitle/metadata text with lower contrast.
- Borders or banding to separate rows; avoid styling every cell heavily.
- Red/green only when meaning is also communicated by text or icon.

Set header row height and alignment, then freeze it:

```ts
const header = sheet.getRow(1);
header.height = 28;
header.font = { bold: true, color: { argb: "FFFFFFFF" } };
header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
header.alignment = { vertical: "middle", wrapText: true };
sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
```

## Widths and heights

ExcelJS does not provide a universal pixel-perfect autofit. Set widths from domain knowledge first. For generated text, estimate based on displayed values and clamp extremes:

```ts
function fitColumn(column: ExcelJS.Column, min = 10, max = 48): void {
  let width = min;
  column.eachCell({ includeEmpty: false }, (cell) => {
    const text = cell.text ?? "";
    width = Math.max(width, Math.min(max, text.length + 2));
  });
  column.width = width;
}
```

Dates, formatted numbers, CJK characters, rich text, and proportional fonts make character-count estimates imperfect. Render and adjust important deliverables. Enable `wrapText` and set row height for long notes rather than creating extremely wide columns.

## Views and navigation

Freeze both header rows and identifier columns where helpful:

```ts
sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1, topLeftCell: "C2" }];
```

Hide gridlines for dashboard/presentation sheets, but usually keep them on raw-data sheets:

```ts
sheet.views = [{ state: "normal", showGridLines: false, zoomScale: 90 }];
```

Do not combine `pageLayout` view with frozen panes.

## Images

Add PNG, JPEG, or GIF images to a document workbook:

```ts
const imageId = workbook.addImage({ filename: logoPath, extension: "png" });
sheet.addImage(imageId, {
  tl: { col: 0, row: 0 },
  ext: { width: 180, height: 48 },
  editAs: "oneCell",
});
```

Use `buffer` or `base64` instead of `filename` in browser contexts. Images are not supported by the streaming writer. Treat coordinates as zero-based fractional column/row positions. Keep aspect ratio and test in the target viewer.

## Page setup

Configure printable reports explicitly:

```ts
sheet.pageSetup = {
  paperSize: 9,
  orientation: "landscape",
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  printArea: `A1:H${sheet.rowCount}`,
  printTitlesRow: "1:2",
  margins: {
    left: 0.35,
    right: 0.35,
    top: 0.6,
    bottom: 0.6,
    header: 0.2,
    footer: 0.2,
  },
};
```

Paper size `9` is A4. Use fit-to-width cautiously: extremely wide tables become unreadably small. Consider splitting logical sections across sheets instead.

Set `horizontalCentered`, `blackAndWhite`, `showGridLines`, print titles, and print areas based on the document's use. Render to PDF when page breaks are part of acceptance criteria.

## Headers and footers

Use Excel header/footer codes:

```ts
sheet.headerFooter.oddHeader = '&L&BMonthly Sales&C&A&R&D';
sheet.headerFooter.oddFooter = '&LConfidential&C&F&RPage &P of &N';
```

Common codes: `&L`, `&C`, `&R` positions; `&P` page; `&N` total pages; `&D` date; `&T` time; `&A` sheet; `&F` file; `&B` bold; `&I` italic. Header/footer images are not supported by ExcelJS.
