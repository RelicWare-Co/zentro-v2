# Worker Batch 11 Output

## File Fixed

- `features/pos/components/modals/checkout-modal.tsx`

## Errors Fixed

### 1. `lint/complexity/noExcessiveCognitiveComplexity` (line 70, complexity 35 → within limit)

Extracted three sub-components and four helper functions to reduce the main component's cognitive complexity:

**Sub-components extracted:**

- `DiscountSection` — discount toggle checkbox + conditional amount input
- `CreditSaleWarnings` — all conditional credit-sale warning messages and account info
- `PaymentMethodsSection` — payment methods list mapping, remove buttons, amount/reference inputs, and "add method" button

**Helper functions extracted:**

- `getFooterLabel(isCreditSale, canReturnCashChange)`
- `getFooterValue(isCreditSale, canReturnCashChange, paymentDifference, cashChangeDue)`
- `getFooterValueClassName(isCreditSale, shouldCreateCreditBalance, canReturnCashChange, paymentDifference)`
- `getConfirmButtonText(isProcessing, shouldCreateCreditBalance)`

No logic was changed; only code was moved into smaller units.

### 2. `lint/style/noNestedTernary` (lines 117, 122, 421, 426, 428, 464)

Replaced all nested ternary expressions with explicit `if/else` blocks via the helper functions above and JSX extraction:

- **Lines 117–122 (footer label / footer value):** replaced with `getFooterLabel` and `getFooterValue` helpers.
- **Lines 421–428 (footer value color class):** replaced with `getFooterValueClassName` helper.
- **Line 464 (confirm button text):** replaced with `getConfirmButtonText` helper.
- The `CreditSaleWarnings` component also replaces the nested conditional JSX blocks with flat, early-return-style conditional rendering.

## Verification

```bash
bunx biome check --max-diagnostics=100 features/pos/components/modals/checkout-modal.tsx
```

Result: **0 errors** (`Checked 1 file in 11ms. No fixes applied.`)

TypeScript also reports no errors for the modified file.
