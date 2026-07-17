# Report user-facing labels and identifiers

## Symptom

- Sales details displayed database status values such as `completed` and `credit`.
- Excel movement details displayed database type values such as `expense` and `inflow`.
- Sales, products, and movement reports exposed internal IDs that users cannot search or otherwise use.

## Root cause

- The report UI and workbook wrote raw status and movement type fields directly in some presentation paths.
- The initial workbook treated database identifiers as useful report dimensions even though the product has no ID-based lookup workflow.

## Solution

- Added shared report label formatters and used them in both the report page and Excel workbook.
- Removed internal ID columns from the visible sales table and from the sales, products, and movements worksheets.
- Kept identifiers in the report payload because the UI still needs stable row keys and the data builder needs relational identifiers.

## Verification

- `bun test tests/reports.test.ts` passes 5 tests, including translated sale status and movement type labels and worksheet headers without ID columns.
- `bunx tsc --noEmit` passes.
