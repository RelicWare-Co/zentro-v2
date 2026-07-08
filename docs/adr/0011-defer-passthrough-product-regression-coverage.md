# ADR 0011: Defer passthrough product regression coverage

## Status

Accepted

## Date

2026-07-08

## Context

The passthrough product change introduces "no contable" products that are billed and collected normally while being excluded from accounting revenue. It also adds optional automatic cash payouts linked to sales and reversed on cancellation.

The initial implementation touches persistent schema, Zero exposure, product setup, POS totals, sale creation, sale cancellation, public orders, dashboard metrics, admin metrics, and shift reporting. The behavior crosses several product surfaces and includes accounting-sensitive rules:

- Existing products default to `revenue`.
- Sale-level discounts apply only to revenue products.
- Passthrough items reject item discounts and modifiers.
- Credit sales with passthrough require immediate payment for at least the passthrough total.
- Automatic payouts create linked `cashMovement` records and cancellation creates reversal movements.
- Public ordering excludes passthrough products and rejects manipulated payloads.
- Dashboard, admin, top products, and shifts exclude passthrough lines from accounting revenue and rankings while cash closure continues to reflect real money movement.

## Decision

Defer the full regression test suite for passthrough products to a follow-up implementation slice instead of blocking the current behavior corrections on broad coverage work.

The follow-up coverage must add focused unit/integration tests for:

- Product defaults and validation for `accountingTreatment`, `autoPayoutEnabled`, and `autoPayoutPaymentMethod`.
- Sale totals with passthrough subtotals, taxes, totals, and historical `saleItem.accountingTreatment` snapshots.
- Sale-level discount allocation across revenue items only.
- Rejection of passthrough item discounts and modifiers.
- Credit sale passthrough payment requirements and credit balance calculation.
- Automatic payout creation, shift close impact, and sale cancellation reversal.
- Public catalog filtering and manipulated public order rejection.
- Dashboard, admin, top-product, and shift reporting exclusion of passthrough revenue and rankings.

## Consequences

- The current change may ship only after narrow verification confirms the immediate code fixes, but it is not considered fully regression-covered.
- Future changes to sales, shifts, public orders, or reports should treat passthrough behavior as high risk until this ADR is closed by test coverage.
- This ADR should be superseded or marked completed once the follow-up coverage lands.

