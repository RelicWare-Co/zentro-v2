# POS Table Discount Input

## Symptom

When the payment modal was opened from a restaurant table in the POS, typing in the discount input did not work. Opening the same payment modal outside table mode allowed the discount to be entered normally.

## Cause

The modal reused the POS checkout discount component, but table mode exposed `discountInput` as `"0"` and ignored `setDiscountInput` while `activeTableId` existed.

Relevant files:

- `features/pos/pos-page-context.tsx`
- `features/pos/hooks/use-pos-table-order.ts`

That meant the input was controlled by a value that never changed in table mode. The issue was not focus or browser input behavior.

There was a second contract gap: table totals were calculated with a hard-coded `"0"` discount, and `closeOrder` did not accept or pass a sale-level `discountAmount` to `createCoreSale`.

## Solution

Added separate table discount state in the POS context and used it as the effective discount while a table is active. Table order totals now calculate with that discount, and closing a table sends `discountAmount` through the restaurant close-order contract into `createCoreSale`.

Touched areas:

- POS context state and checkout wiring.
- Table order totals and close-order payload.
- Restaurant close-order schemas and server mutation.
- Regression coverage for closing a table with a sale-level discount.

## Verification

- `bun test tests/restaurants.test.ts` passed.
- `bunx tsc --noEmit` passed.
- `bun run check` still failed only on pre-existing unrelated SVG/HTML formatting and accessibility issues in `assets/logo.svg`, `desktop/assets/logo-icon.svg`, and `desktop/src/renderer/index.html`.
