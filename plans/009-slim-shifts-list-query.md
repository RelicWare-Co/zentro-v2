# Plan 009: Slim the shifts list query — stop fetching the deep sales/items/product graph for list rows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/shifts/shifts.queries.ts features/shifts/shifts.shared.ts features/shifts/components/shift-list-item.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: 008 (typecheck gate must be green to verify changes)
- **Category**: performance
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

The shifts list query (`shiftsQueries.shifts.list`) calls `applyShiftRelations`
which loads the **entire relationship graph** for every shift row: payments →
sale → creditTransactions, sales → items → product → category, cashMovements,
and closures. On a busy org with 50 shifts per page, each having 20+ sales
with 5+ items each, this replicates thousands of rows that the list view never
renders. The list item card (`ShiftListItemCard`) only needs summary totals
(payment breakdown, operations counts, expected/actual/difference) — it does
not display individual sale items, product names, or category information.

The detail query (`shiftsQueries.shifts.byId`) legitimately needs the full
graph for the detail panel. The fix is to split the relations: a lightweight
`applyShiftListRelations` for the list, and the existing `applyShiftRelations`
for the detail.

## Current state

- `features/shifts/shifts.queries.ts:11-34` — `applyShiftRelations` loads:
  - `user` (needed by both list and detail)
  - `cashMovements` (needed by both — movements list and expected-amount computation)
  - `closures` (needed by both — actual amounts and differences)
  - `sales` → `items` → `product` → `category` (needed by detail only; list
    only reads `sale.status` and `sale.totalAmount` for the operations summary
    in `buildShiftOperations` at `shifts.shared.ts:262-308`)
  - `payments` → `sale` + `creditTransactions` (needed by both — payment
    breakdown, debt payment detection, cancelled-sale filtering)
- `features/shifts/shifts.queries.ts:63` — `buildShiftsListQuery` calls
  `applyShiftRelations(...)` — this is the call site to change.
- `features/shifts/shifts.queries.ts:36-39` — `buildShiftDetailQuery` calls
  `applyShiftRelations(...)` — this stays as-is (full graph for detail).
- `features/shifts/shifts.shared.ts:262-308` — `buildShiftOperations` reads
  `sales` rows but only accesses `row.status`, `row.totalAmount`, and `row.id`.
  It does NOT access `row.items` or any item/product/category data.
- `features/shifts/shifts.shared.ts:310-341` — `normalizeShiftPayments` reads
  `paymentRow.sale?.status` and `paymentRow.sale?.totalAmount` (to filter
  cancelled-sale payments and compute saleTotalAmount), and
  `paymentRow.creditTransactions` (to detect debt payments). So `payments` still
  needs `sale` and `creditTransactions` relations for the list.
- `features/shifts/shifts.shared.ts:369-467` — `buildShiftListItem` is the
  function that consumes the `ShiftWithRelations` and produces the `ShiftListItem`.
  It accesses: `shift.user`, `shift.cashMovements`, `shift.closures`,
  `shift.payments` (with `.sale` and `.creditTransactions`), and `shift.sales`
  (with `.status` and `.totalAmount` only). It does NOT access
  `shift.sales[].items`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/shifts.test.ts tests/pos.test.ts` | all pass |

## Scope

**In scope**:
- `features/shifts/shifts.queries.ts` (add `applyShiftListRelations`, use it in
  `buildShiftsListQuery`)
- `features/shifts/shifts.shared.ts` (update `ShiftWithRelations` type if
  needed — the `sales` field on the list variant should not require `items`)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `features/shifts/shifts.queries.ts` `buildShiftDetailQuery` — the detail query
  keeps the full graph.
- `features/shifts/components/shift-list-item.tsx` — the UI component does not
  change; it consumes `ShiftListItem` which is produced by
  `buildShiftListItem` and already excludes item-level data.
- `features/shifts/shifts.shared.ts` `buildShiftListItem` — the function logic
  stays the same; it already only reads `sales[].status` and
  `sales[].totalAmount`. The type annotation on `ShiftWithRelations["sales"]`
  may need to be loosened to not require `items`.
- Server-side summary tables or persisted closure totals — that is a larger
  redesign deferred to a future plan.

## Git workflow

- Branch: `advisor/009-slim-shifts-list-query`
- Conventional commit, e.g. `perf(shifts): drop deep sales graph from list query`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add `applyShiftListRelations`

In `features/shifts/shifts.queries.ts`, add a new function that loads only the
relations the list needs — everything from `applyShiftRelations` EXCEPT the
deep `sales → items → product → category` chain. The `sales` relation itself
is still needed (for `buildShiftOperations` to count paid/cancelled/credit
sales), but without the `items` sub-relation:

```ts
function applyShiftListRelations<T extends ReturnType<typeof zql.shift.where>>(
  query: T
) {
  return query
    .related("user")
    .related("cashMovements", (cashMovementQuery) =>
      cashMovementQuery.orderBy("createdAt", "desc").orderBy("id", "desc")
    )
    .related("closures")
    .related("sales")
    .related("payments", (paymentQuery) =>
      paymentQuery
        .related("sale")
        .related("creditTransactions")
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
    );
}
```

**Verify**: `bunx tsc --noEmit` → check for new type errors. The
`ShiftWithRelations` type in `shifts.shared.ts` declares `sales?` with an
optional `items` field — if the type requires `items`, you will need to make
`items` optional on the `ShiftWithRelations["sales"]` element type (it should
already be optional since it comes from a Zero relation). If `tsc` passes,
proceed.

### Step 2: Use `applyShiftListRelations` in `buildShiftsListQuery`

In `features/shifts/shifts.queries.ts`, change `buildShiftsListQuery` (line ~63)
from:

```ts
let query = applyShiftRelations(
  zql.shift.where("organizationId", organizationId)
);
```

to:

```ts
let query = applyShiftListRelations(
  zql.shift.where("organizationId", organizationId)
);
```

Leave `buildShiftDetailQuery` (line ~37) using `applyShiftRelations` — the
detail view needs the full graph including items/products/categories.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Verify `buildShiftListItem` still works with the slimmed data

`buildShiftListItem` in `shifts.shared.ts:369-467` accesses `shift.sales` but
only reads `row.status`, `row.totalAmount`, and `row.id` (in
`buildShiftOperations`). It does NOT access `row.items`. Confirm this by
searching:

```bash
grep -n "\.items" features/shifts/shifts.shared.ts
```

The only matches should be in `buildShiftProductSummary` or similar functions
that are NOT called from `buildShiftListItem`. If `buildShiftListItem` or any
function it calls accesses `sales[].items`, STOP — the plan's assumption is
wrong and the slimmed query would break the list.

**Verify**: `bun run fix && bun run check` → exit 0.

### Step 4: Run the shift and POS test suites

The integration tests exercise shift listing and reconciliation via
`listShiftsViaZero` and `getShiftDetailViaZero` in `tests/helpers/zero-shifts.ts`.
These tests will catch any behavioral regression from the slimmed query.

**Verify**: `docker compose up -d postgres && bun test tests/shifts.test.ts tests/pos.test.ts` → all pass.

## Test plan

No new tests needed — the existing shift integration tests cover list and
detail flows. The slimmed query is a data-fetching optimization; the client-side
computation in `buildShiftListItem` is unchanged.

## Done criteria

- [ ] `applyShiftListRelations` exists and omits the `sales → items → product → category` chain
- [ ] `buildShiftsListQuery` uses `applyShiftListRelations`
- [ ] `buildShiftDetailQuery` still uses `applyShiftRelations` (full graph)
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run check` exits 0
- [ ] `bun test tests/shifts.test.ts tests/pos.test.ts` all pass
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `buildShiftListItem` or any function it directly calls accesses
  `shift.sales[].items` — the slimmed query would break the list; the plan's
  assumption is wrong.
- The `ShiftWithRelations` type makes `sales[].items` a required field (not
  optional) and loosening it causes type errors elsewhere — report the exact
  type chain.
- The `whereExists("cashMovements", ...)` or `exists("payments", ...)` filters
  in `buildShiftsListQuery` (lines 82-101) require relations that
  `applyShiftListRelations` does not load — report which relation is missing.
- Any shift integration test fails after the change — report the test name and
  assertion that broke.

## Maintenance notes

- **Future optimization (deferred)**: for closed shifts, the `shiftClosure`
  table already persists `expectedAmount`, `actualAmount`, and `difference` per
  payment method. A server-side summary query could read those directly instead
  of recomputing expected amounts from the full payments + movements graph.
  This would eliminate the `payments` → `sale` + `creditTransactions` and
  `cashMovements` relations from the closed-shift list path entirely. Plan this
  when shift volume causes noticeable replication lag.
- **`sales` relation still needed**: even the slimmed query loads `sales`
  (without items) because `buildShiftOperations` counts paid/cancelled/credit
  sales by status. A future server-side summary could pre-compute these counts
  and eliminate the `sales` relation from the list entirely.
- If `posv2` ever replaces `pos`, verify that the shift list query is still
  used the same way.
