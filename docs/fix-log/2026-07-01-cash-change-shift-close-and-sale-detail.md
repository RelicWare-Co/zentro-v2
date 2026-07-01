# Cash change accounting and visibility in shift close

## Symptom

- Cash sales with overpayment (for example, total 480 and received 500) were perceived as if change was not recorded.
- Operators reported end-of-shift mismatch risk when reviewing expected cash.
- Sale detail UI showed only the applied amount and did not explicitly show tendered and returned change.

## Root cause

- Shift expected-by-method aggregation relied on applied amount fallback behavior and did not consistently derive net inflow from tendered minus change.
- In sale detail, payment rows displayed applied amount only, which hid change details from operators.

## Solution

- Updated shift expected amount aggregation to compute net inflow per payment as `amount - changeAmount`.
- Kept existing legacy fallback behavior in place for historical records without explicit applied allocation.
- Updated sale detail payment UI to show:
  - Received (tendered) amount
  - Returned change
  - Applied amount as the primary payment value

## Files changed

- features/shifts/shifts.shared.ts
- features/sales/components/sale-detail-content.tsx

## Verification

- Type-check for modified files reports no errors.
- Manual validation scenario to run:
  1. Create cash sale with total 480 and tendered 500.
  2. Verify sale detail shows received 500, change 20, applied 480.
  3. Open shift close summary and verify expected cash increases by 480 (not 500).
  4. Close shift with physical cash count and verify difference is correct.
