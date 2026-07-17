# Streaming and performance

## Contents

- Selection criteria
- Streaming writer
- Streaming reader
- Performance practices
- Unsupported or risky features

## Selection criteria

Use the document API until memory profiling or known scale justifies streaming. It is simpler and supports the widest feature set.

Choose streaming for sequential exports with hundreds of thousands or millions of rows when:

- Rows can be produced in final order.
- Committed rows never need to be revisited.
- The workbook does not need pivot tables or images.
- Cross-row formulas/results can be computed before commit.
- A one-pass architecture is acceptable.

## Streaming writer

```ts
const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
  filename: outputPath,
  useStyles: true,
  useSharedStrings: false,
  zip: { zlib: { level: 6 } },
});

const sheet = workbook.addWorksheet("Export", {
  views: [{ state: "frozen", ySplit: 1 }],
});
sheet.columns = columns;

for await (const item of source) {
  sheet.addRow(item).commit();
}

sheet.commit();
await workbook.commit();
```

Commit rows as soon as no later merge or mutation needs them. Commit each sheet, then await the workbook commit. If a merged range spans multiple rows, delay commit until the bottom row is complete.

Set `useStyles: true` only when styles are needed. Shared strings can reduce file size for repeated strings but increase memory usage; benchmark representative data. The Protobi fork contains a rich-text shared-string fix, but still test exact workloads.

## Streaming reader

Prefer async iteration for flow control:

```ts
const reader = new ExcelJS.stream.xlsx.WorkbookReader(inputPath, {
  sharedStrings: "cache",
  hyperlinks: "ignore",
  styles: "ignore",
  worksheets: "emit",
});

for await (const sheet of reader) {
  for await (const row of sheet) {
    processRow(row);
  }
}
```

Choose `cache`, `emit`, or `ignore` based on whether cell values need resolved shared strings/hyperlinks/styles. Ignoring styles reduces work when importing raw data.

## Performance practices

- Stream source data from the database or input file instead of materializing a second full array.
- Compute formulas' cached results in application code before committing rows.
- Reuse immutable style objects and avoid per-cell object allocation when column/row styles suffice.
- Avoid expensive `eachCell` passes after building large sheets.
- Use bounded concurrency upstream; preserve row order at the writer.
- Measure memory and wall time with representative strings, styles, formulas, and row counts.
- Consider splitting datasets across sheets before approaching Excel's worksheet limit of 1,048,576 rows.
- Keep columns within Excel's 16,384-column limit.
- Check final file size and open time, not only generation time.

## Unsupported or risky features

- Pivot tables are unsupported in the streaming writer.
- Images are unsupported in streaming mode.
- A committed row cannot be changed or accessed.
- Worksheets cannot be removed after being added.
- `unMergeCells()` is unsupported.
- Existing workbook editing is a document-API task, not a streaming-writer task.
- Complex conditional formatting, validations, comments, and protection should be fixture-tested before relying on streaming compatibility.
