# POS customer reset between sales

## Symptom

After completing a sale with a selected customer, the customer remained selected when opening the payment modal for the next sale.

## Cause

`selectedCustomerId` belongs to the POS page context and was not reset by the sale-success flow. Closing the payment modal and clearing the cart only reset checkout state.

## Solution

Reset the selected customer in the shared sale-completed callback after starting receipt printing. This covers counter, quick, and table sale flows while preserving the customer in the receipt snapshot.

## Verification

- `PLAYWRIGHT_BASE_URL=http://localhost:3000 ZERO_CACHE_URL=http://localhost:4848 bunx playwright test tests/e2e/pos/cash-sale.spec.ts --project=chromium --grep "resets the customer" --reporter=line` — 2 passed.
- `PLAYWRIGHT_BASE_URL=http://localhost:3000 ZERO_CACHE_URL=http://localhost:4848 bunx playwright test tests/e2e/pos/cash-sale.spec.ts --project=chromium --reporter=line` — 4 passed.
- `bun run check` — passed.
- `bunx tsc --noEmit` — passed.
- `git diff --check` — passed.
