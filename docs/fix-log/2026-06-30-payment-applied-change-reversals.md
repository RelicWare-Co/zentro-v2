# Payment Applied Amounts And Reversals

## Symptom

Cash overpayments preserved the tendered amount in `payment.amount`, but sale
balances, close summaries, and payment mix could still infer applied cash from
heuristics. Paid completed sales also could not be cancelled without losing the
audit trail for the original payment.

## Cause

The payment table had only one money column, so the app had to reuse
`payment.amount` for both tendered and applied money. Cancellation protected
accounting by rejecting paid sales entirely instead of recording a reversing
payment entry.

## Solution

- Added `payment.applied_amount` and `payment.change_amount` while keeping
  `payment.amount` as the tendered amount.
- Sale creation now stores applied and change amounts per payment; cash
  overpayment applies only the sale balance and records returned change.
- Shift close and dashboard payment mix use explicit applied amounts when
  present, with the previous cash-change heuristic only as a legacy fallback.
- Completed-sale cancellation now inserts negative payment reversals linked by
  `reference = reversal:<paymentId>` before marking the sale cancelled.
- Credit payment allocation reads and writes applied amounts so sale balances
  do not depend on tendered/change semantics.

## Verification

```bash
bunx tsc --noEmit
bun test tests/sales.test.ts tests/pos.test.ts tests/cross-area.test.ts tests/error-recovery.test.ts tests/dashboard-overview.test.ts tests/credit.test.ts tests/concurrency.test.ts
bun run check
```
