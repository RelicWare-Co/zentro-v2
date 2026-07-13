# Restaurant table soft delete

## Symptom

Administrators could not remove a restaurant table once it had any order
history. The API returned `No puedes eliminar una mesa que ya tiene historial.`

## Root cause

The delete operation performed a hard delete and rejected every table with a
linked `restaurant_order`. PostgreSQL also protects that relation with
`ON DELETE RESTRICT`, so removing the application guard would still fail and
would risk breaking historical reporting.

## Solution

- Added nullable `restaurant_table.deleted_at` and replicated it through Zero.
- Changed table deletion to mark the table as deleted and keep its order IDs.
- Hide deleted tables from the restaurant layout and table-detail queries.
- Keep deletion blocked only while the table has an open order.
- Use a partial unique index for active table names, allowing a replacement
  table with the same name after deletion.

## Verification

- `bun test tests/restaurants.test.ts`
- `bunx tsc --noEmit`
- `bun run check`

The regression test creates a closed order, soft-deletes its table, verifies
that the table is absent from the active configuration, and confirms that the
order still references the table.
