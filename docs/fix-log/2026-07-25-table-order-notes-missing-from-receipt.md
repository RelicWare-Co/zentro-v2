# Table order notes missing from receipt

## Symptom

A general note saved on an open table order did not appear on the thermal
receipt when the cashier closed and charged the table.

## Cause

`features/restaurants/table-sale-mode.ts` built the receipt snapshot with the
cart, payments, and totals only. `buildSaleReceiptDocument` also had no general
note field, so the note stored in `restaurant_order.notes` was dropped at the
printing boundary.

## Solution

The table sale adapter now copies the open order note into the shared receipt
snapshot. The sale receipt printer forwards it to the document builder, which
renders it as `Nota de la orden`. Counter-sale snapshots remain unchanged.

## Verification

- `bun test tests/pos-receipt.test.ts`
- `bunx tsc --noEmit`
- `bun run check`
- `bun run build`
