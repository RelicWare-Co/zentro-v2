# POS checkout stock error reset

## Symptom

After a sale failed because of insufficient stock, the error remained visible in the payment modal even after the rejected product was removed from the cart.

## Cause

The stock rejection was stored in the TanStack Query sale mutation. Cart changes updated only the cart state, so the stale mutation error continued to render in the checkout footer.

## Solution

Reset the sale mutation when the cart reference changes in `features/pos/hooks/use-pos-checkout.ts`. Added an E2E regression covering the stock rejection, product removal, replacement product, and checkout reopen flow.

## Verification

- `PLAYWRIGHT_BASE_URL=http://localhost:3000 ZERO_CACHE_URL=http://localhost:4848 bunx playwright test tests/e2e/pos/cash-sale.spec.ts --project=chromium --grep "clears a stock error" --reporter=line` — 2 passed.
- `bun run check` — passed.
- `bunx tsc --noEmit` — passed.
- `git diff --check` — passed.
