# Plan 013: Slim the sales list query — stop fetching payments and items for every sale row

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/sales/sales.queries.ts features/sales/components/`
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

The sales list query (`salesQueries.sales.list`) loads `.related("payments")`
and `.related("items")` for every sale in the list. The list view only needs
summary fields (total, status, date, cashier, customer, shift/terminal).
Payments and items are only needed for the sale detail view
(`salesQueries.sales.byId`), which already loads them with deeper relations
(`creditTransactions`, `product`, `modifiers`). On a busy org with many sales
per page, each having several payments and line items, this replicates rows
the list view never renders as individual entities.

## Current state

- `features/sales/sales.queries.ts:38-44` — `buildSalesListQuery` loads:

  ```ts
  let query = zql.sale
    .where("organizationId", organizationId)
    .related("user")        // needed — cashier name in list
    .related("customer")    // needed — customer name in list
    .related("shift")       // needed — terminal name in list
    .related("payments")    // NOT needed for list — only for detail
    .related("items");      // NOT needed for list — only for detail
  ```

- `features/sales/sales.queries.ts:112-128` — `buildSaleDetailQuery` loads the
  full graph including `payments.related("creditTransactions")` and
  `items.related("product").related("modifiers")` — this is correct for detail
  and stays as-is.
- `features/sales/sales.queries.ts:69-73` — the `whereExists("payments", ...)`
  filter used for payment-method filtering. `whereExists` creates a subquery
  existence check and does NOT require `.related("payments")` to be eager-loaded
  on the query. Verify this before removing (Step 1).
- `features/sales/sales.shared.ts:169-187` — `buildSaleListItem` produces the
  `SaleListItem` the list panel renders. It reads `row.customer?.name`,
  `row.user?.name`, `row.shift?.terminalName` (needed relations), AND:
  - `sumItemCount(row)` at `:154-159` reads `row.items` to sum `itemRow.quantity`
    → produces `itemCount`.
  - `sumPaidAmount(row)` at `:142-152` reads `row.payments` to sum
    `appliedAmount`/`amount` → produces `paidAmount` and `balanceDue`.
  - `collectPaymentMethods(row)` at `:161-167` reads `row.payments` to collect
    `paymentRow.method` → produces `paymentMethods`.
  All three use `row.items ?? []` / `row.payments ?? []` defaults, so removing
  the relations will NOT cause a typecheck failure — it will silently regress
  `itemCount` to `0`, `balanceDue` to `totalAmount` (for non-cancelled unpaid
  sales), and `paymentMethods` to `[]`.
- `features/sales/components/sales-list-panel.tsx` — the list UI renders
  `sale.customerName`, `sale.cashierName`, `sale.createdAt`, `sale.totalAmount`,
  `sale.status`, AND `sale.itemCount` (line ~88, via
  `formatItemCountLabel(sale.itemCount)`) and `sale.balanceDue` (lines ~114-115,
  shown when `> 0`). It does NOT render individual payment methods or line items
  in the list rows, but it DOES render the `itemCount` and `balanceDue` summary
  fields that are currently derived from `payments`/`items`.
- `features/sales/components/sale-detail-content.tsx:76,131,135` — the only
  component that maps over `sale.items` and `sale.payments` individually; it
  consumes the detail query result, not the list query result.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/sales.test.ts tests/pos.test.ts` | all pass |

## Scope

**In scope**:
- `features/sales/sales.queries.ts` (remove `.related("payments")` and
  `.related("items")` from `buildSalesListQuery`)
- Any client components/helpers that access `payments` or `items` from the list
  query result — i.e. `buildSaleListItem` / `sumItemCount` / `sumPaidAmount` /
  `collectPaymentMethods` in `features/sales/sales.shared.ts` if the list still
  needs `itemCount`/`balanceDue`/`paymentMethods` (see Steps — this is the key
  decision point)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `features/sales/sales.queries.ts` `buildSaleDetailQuery` — keeps the full graph
  (`payments` → `creditTransactions`, `items` → `product` → `modifiers`).
- `features/sales/components/sale-detail-content.tsx` and `sale-detail-sheet.tsx`
  — detail UI consumes the detail query and is unchanged.
- Persisted/server-side sale summaries — a larger redesign deferred to a future
  plan (see Maintenance notes).

## Git workflow

- Branch: `advisor/013-slim-sales-list-query`
- Conventional commit, e.g. `perf(sales): drop payments and items from list query`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Verify `whereExists("payments", ...)` does not require `.related("payments")`

The payment-method filter at `features/sales/sales.queries.ts:69-73` uses
`query.whereExists("payments", ...)`. In Zero, `whereExists` builds a subquery
existence check and does NOT require the relation to be eager-loaded via
`.related(...)`. Confirm this against the Zero documentation or empirically
(temporarily remove `.related("payments")`, keep the `whereExists`, run
typecheck + a filtered list test). The `exists("customer", ...)` /
`exists("user", ...)` / `exists("shift", ...)` calls inside the search
`where` (lines 74-96) are the same mechanism and likewise do not require
eager loads.

**Verify**: `bunx tsc --noEmit` → exit 0 with `.related("payments")` removed
and the `whereExists("payments", ...)` filter still present. If `tsc` errors
on the `whereExists` call, STOP — the relation is required and the plan's
core assumption is wrong.

### Step 2: Remove `.related("payments")` and `.related("items")` from `buildSalesListQuery`

In `features/sales/sales.queries.ts:38-44`, change:

```ts
let query = zql.sale
  .where("organizationId", organizationId)
  .related("user")
  .related("customer")
  .related("shift")
  .related("payments")
  .related("items");
```

to:

```ts
let query = zql.sale
  .where("organizationId", organizationId)
  .related("user")
  .related("customer")
  .related("shift");
```

Leave `buildSaleDetailQuery` (line ~112) unchanged — it keeps the full graph.

**Verify**: `bunx tsc --noEmit` → exit 0. NOTE: because `buildSaleListItem`
reads `row.items ?? []` and `row.payments ?? []` with nullish defaults,
typecheck will NOT catch a silent regression of `itemCount`/`balanceDue`/
`paymentMethods`. Do not treat a green `tsc` as proof the list is correct —
proceed to Step 3.

### Step 3: Audit and fix client code that reads `payments`/`items` from list data

`buildSaleListItem` (`features/sales/sales.shared.ts:169-187`) currently derives
`itemCount`, `paidAmount`, `balanceDue`, and `paymentMethods` from `row.items`
and `row.payments`. With the relations removed these become `[]`, so:

- `itemCount` → `0` (list panel shows "0 artículos")
- `balanceDue` → `totalAmount` for any non-cancelled sale (list panel shows a
  false "Pendiente" badge on every unpaid-looking sale)
- `paymentMethods` → `[]`

Decide per the list UI's actual requirements:

1. If `itemCount` and `balanceDue` are NOT needed in the list (confirm against
   `sales-list-panel.tsx` — today it DOES render both), remove those fields from
   `SaleListItem` / `SaleListResultSchema` and stop computing them in
   `buildSaleListItem`. Also drop `paymentMethods` if unused by the list.
2. If they ARE needed, this is a STOP condition — the summary fields cannot be
   computed without the relations, and the slimming requires a server-side
   summary (deferred, see Maintenance notes) OR keeping one of the relations.

Search the list path to confirm no other consumer reads `payments`/`items`
from list query results:

```bash
grep -rn "\.payments\|\.items" features/sales/components/sales-list-panel.tsx features/sales/sales.shared.ts
```

The only legitimate matches should be inside `buildSaleDetail` /
`resolvePaymentKind` (detail path) and the three list helpers above. If a list
component maps over `sale.payments` or `sale.items` directly, STOP.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0. Manually confirm the list panel no longer references
`sale.itemCount` / `sale.balanceDue` / `sale.paymentMethods` if those fields
were removed, OR that a decision was made to keep them (STOP).

### Step 4: Run the sales and POS test suites

The integration tests exercise sale listing and detail via the Zero query
helpers. They will catch behavioral regressions in list building, though they
may NOT assert on `itemCount`/`balanceDue` values — so a silent regression
could still pass tests. Favor the manual audit in Step 3 as the primary guard.

**Verify**: `docker compose up -d postgres && bun test tests/sales.test.ts tests/pos.test.ts` → all pass.

## Test plan

No new automated tests needed — the change is a data-fetching trim. The
existing sales integration tests cover list and detail flows. If
`itemCount`/`balanceDue` are removed from `SaleListItem`, add or extend a test
asserting the list result no longer includes those fields (optional, low
value). Manual verification path (optional, requires running app): open the
sales list, confirm rows still show cashier/customer/terminal/date/total/
status correctly, and confirm `itemCount`/`balanceDue` either still render
correctly (if kept) or are gone (if removed).

## Done criteria

- [ ] `.related("payments")` and `.related("items")` removed from
  `buildSalesListQuery`
- [ ] `buildSaleDetailQuery` still loads the full graph (`payments` →
  `creditTransactions`, `items` → `product` → `modifiers`)
- [ ] `whereExists("payments", ...)` filter still works without the eager load
- [ ] No list-path client code silently regresses `itemCount`/`balanceDue`/
  `paymentMethods` (either removed cleanly, or a STOP was triggered)
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run check` exits 0
- [ ] `bun test tests/sales.test.ts tests/pos.test.ts` all pass
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `whereExists("payments", ...)` at `sales.queries.ts:69-73` requires
  `.related("payments")` to be present (typecheck or runtime error after
  removal) — the core assumption is wrong; report the exact error.
- `buildSaleListItem` (or `sumItemCount` / `sumPaidAmount` /
  `collectPaymentMethods`) still needs `row.items` / `row.payments` to produce
  `itemCount` / `balanceDue` / `paymentMethods` that the list panel renders
  (`sales-list-panel.tsx` shows `sale.itemCount` and `sale.balanceDue`) AND
  those summary fields are required by the product — the slimming cannot be
  done without a server-side summary. Report which fields are affected and let
  the maintainer decide whether to drop them from the list UI or defer this
  plan.
- A sales list component maps over `sale.payments` or `sale.items` directly from
  the list query result — the plan's assumption that only the detail view uses
  them is wrong.
- Any sales integration test fails after the change — report the test name and
  assertion that broke.

## Maintenance notes

- **Future optimization (deferred)**: the `sale` row already carries
  `totalAmount` and `status`; a server-side summary could persist
  `paidAmount`/`balanceDue`/`itemCount`/`paymentMethods` (or compute them in a
  Zero view) so the list query needs neither `payments` nor `items`. That would
  eliminate the tension this plan hits in Step 3. Plan it when sales list
  volume causes noticeable replication lag.
- **`whereExists` vs `.related`**: this plan relies on Zero's `whereExists` /
  `exists` being subquery existence checks independent of eager loads. If a
  future Zero version couples them, re-evaluate.
- If `posv2` ever replaces `pos`, verify the sales list query and list panel
  are still used the same way.
