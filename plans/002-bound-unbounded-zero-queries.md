# Plan 002: Bound the Zero queries that replicate unbounded history to the browser

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d97b06e..HEAD -- src/zero/queries.ts features/restaurants features/credit features/pos/hooks tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-test-gate-and-ci.md (for a trustworthy test gate)
- **Category**: perf
- **Planned at**: commit `d97b06e`, 2026-06-10

## Why this matters

Zentro uses Rocicorp Zero: every active query's result set is **replicated
into the browser's client cache and kept in sync**. Three queries in
`src/zero/queries.ts` have no upper bound, so their cost grows monotonically
with the life of an organization:

1. `restaurants.kitchenBoard` syncs **every kitchen ticket ever created** to
   the kitchen display, even though the UI only renders tickets in `sent` or
   `ready` status. A restaurant running for months ships its entire ticket
   history to a tablet on every load.
2. `credit.transactions` syncs the **full transaction history** of a credit
   account; the hook then paginates **in memory**.
3. `products.categories` and `products.modifiers` sync whole tables —
   acceptable today (these are small in practice) but inconsistent with the
   repo's own convention (`products.posCatalog` caps at 1000, `shifts.list`
   pages at 50).

This plan adds server-side filters/limits that match what the UI actually
renders. It does NOT touch `shifts.list` (see Out of scope).

## Current state

All queries live in `src/zero/queries.ts` and are defined with
`defineQuery` + `zql`. Org scoping (`.where("organizationId", ctx.orgID)`)
is correct everywhere — do not change it.

- `src/zero/queries.ts:775-796` — `kitchenBoard`:

  ```ts
  kitchenBoard: defineQuery(({ ctx }) => {
    if (!hasOrgContext(ctx)) { /* empty-result guard */ }
    return zql.restaurantKitchenTicket
      .where("organizationId", ctx.orgID)
      .related("order", (query) =>
        query.where("status", "open")
             .related("table", (tableQuery) => tableQuery.related("area")))
      .related("items", (query) =>
        query.related("product")
             .orderBy("createdAt", "desc").orderBy("id", "desc"))
      .orderBy("createdAt", "desc");
  }),
  ```

  Note: the `.related("order", q => q.where("status","open"))` filters which
  related order rows are *attached*, not which tickets are returned — all
  tickets still sync.

- The consumer is `useKitchenBoard` at
  `features/restaurants/hooks/use-restaurants.ts:273-303`, which passes rows
  to `buildKitchenBoard` (`features/restaurants/restaurants.shared.ts:460`).
  That builder keeps only active work: see
  `features/restaurants/restaurants.shared.ts:485` —
  `(itemRow) => itemRow.status === "sent" || itemRow.status === "ready"`.
  The ticket row's own `status` column defaults to `"sent"`
  (`database/drizzle/schema/restaurant.schema.ts:130`).

- `src/zero/queries.ts:568-580` — `credit.transactions`:

  ```ts
  transactions: defineQuery(creditTransactionsArgsSchema, ({ args, ctx }) => {
    const normalizedCreditAccountId = args.creditAccountId?.trim() ?? "";
    if (!(hasOrgContext(ctx) && normalizedCreditAccountId)) { /* empty guard */ }
    return zql.creditTransaction
      .where("organizationId", ctx.orgID)
      .where("creditAccountId", normalizedCreditAccountId)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc");
  }),
  ```

  Consumer: `features/credit/hooks/use-credit.ts:80-95` — runs the query,
  maps rows with `buildCreditTransactionListItem`, then paginates client-side
  via `paginateCreditTransactions`.

- `src/zero/queries.ts` `products.categories` (~line 462) and
  `products.modifiers` (~line 520) — same shape: org filter + orderBy, no
  `.limit()`. Contrast with the exemplar pattern `normalizeProductLimit`
  (`src/zero/queries.ts:71` area), used by `posCatalog` to clamp
  `args.limit` into a safe range, and `normalizeShiftsPageLimit`
  (`src/zero/queries.ts:134-136`, clamps to 1..50).

- Repo conventions that apply:
  - Pagination convention: fetch `pageSize + 1` to detect a next page (see
    `buildShiftsListQuery`, `src/zero/queries.ts:138-144`).
  - After changing only `queries.ts` you do NOT need `bun run
    zero:schema:gen` (that is for Drizzle schema changes), but `tests/`
    contains Zero-query integration tests that may pin current behavior —
    run the suite.
  - Arg schemas for queries live next to the queries (Zod, see
    `creditTransactionsArgsSchema` in `src/zero/queries.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint/format | `bun run fix` then `bun run check` | check exits 0 |
| Start DB | `docker compose up -d postgres` | healthy |
| Tests | `bun test tests/*.test.ts` | same pass count as before your change |
| Targeted tests | `bun test tests/restaurants.test.ts tests/credit.test.ts tests/products.test.ts` | all pass |

## Scope

**In scope**:
- `src/zero/queries.ts` (the three query groups named above only)
- `features/credit/hooks/use-credit.ts` (only if the limit arg needs wiring)
- `tests/restaurants.test.ts`, `tests/credit.test.ts` (add coverage)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `shifts.list` / `applyShiftRelations` (`src/zero/queries.ts:110-126`): the
  shifts list UI computes expected/actual totals client-side from the FULL
  payments/movements/sales graph (`features/shifts/shifts.shared.ts:255-314`).
  Trimming those relations breaks reconciliation display; fixing it properly
  means persisting/reading summaries server-side — a separate plan.
- `src/zero/schema.gen.ts` — generated, never edit.
- Any mutator, any org-scoping `.where`, `drizzle-zero.config.ts`.

## Git workflow

- Branch: `advisor/002-bound-zero-queries`
- Conventional commits, e.g. `perf(zero): filter kitchen board to active tickets`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Filter `kitchenBoard` to active tickets server-side

In `src/zero/queries.ts:775-796`, add a status filter on the ticket rows so
only tickets the board can render are replicated. Target shape:

```ts
return zql.restaurantKitchenTicket
  .where("organizationId", ctx.orgID)
  .where("status", "IN", ["sent", "ready"])
  .related("order", ...)   // unchanged
  .related("items", ...)   // unchanged
  .orderBy("createdAt", "desc");
```

First confirm which ticket-level statuses `buildKitchenBoard` actually
renders by reading `features/restaurants/restaurants.shared.ts:460-510` —
match its filter exactly (line 485 filters item rows; check whether
ticket-level rows are filtered too, and if the ticket itself is only ever
hidden when its order closes, filter on the related order's status instead
using `whereExists("order", q => q.where("status", "open"))`). If ZQL's
`"IN"` operator is unavailable in this Zero version, use `whereExists` /
`or()` equivalents — check usage elsewhere in the file first.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun test tests/restaurants.test.ts`
→ all pass.

### Step 2: Add a bounded limit to `credit.transactions`

1. Extend `creditTransactionsArgsSchema` with an optional `limit` (Zod
   `z.number().int().positive().max(500).optional()`).
2. Add a clamp helper following the `normalizeShiftsPageLimit` pattern
   (`src/zero/queries.ts:134-136`), default 100, max 500.
3. Append `.limit(<clamped>)` to the query.
4. In `features/credit/hooks/use-credit.ts:80`, pass a limit consistent with
   what `paginateCreditTransactions` exposes (read the hook; if the UI pages
   by 20, request e.g. `pageSize * 5 + 1` or simply the default 100 — keep
   the client-side pagination working unchanged for the first N pages).

**Verify**: `bunx tsc --noEmit` → exit 0; `bun test tests/credit.test.ts` →
all pass.

### Step 3: Cap `products.categories` and `products.modifiers`

Append `.limit(500)` to `products.categories` and `.limit(500)` to
`products.modifiers` in `src/zero/queries.ts` (~lines 462 and 520). 500 is a
deliberate generous cap — these are org-curated lists, not user data streams.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun test tests/products.test.ts tests/pos.test.ts` → all pass.

### Step 4: Add regression tests

In `tests/restaurants.test.ts`, add a test (follow the existing VAL-REST-*
naming and structure in that file): seed a kitchen ticket in a terminal
status (whatever value the schema uses for completed/cancelled — check
`features/restaurants/restaurants.shared.ts` status handling) plus one in
`sent`; assert the `kitchenBoard` query returns only the active one.

In `tests/credit.test.ts`, add a test: create >limit transactions is
impractical — instead assert the query with `limit: 5` returns exactly 5
rows ordered by `createdAt` desc.

**Verify**: `bun test tests/restaurants.test.ts tests/credit.test.ts` → all
pass, including the 2 new tests.

### Step 5: Full gate

**Verify**: `bun run fix && bun run check` → exit 0; `bunx tsc --noEmit` →
exit 0; `bun test tests/*.test.ts` → no new failures vs. the baseline you
recorded before starting.

## Test plan

- New: kitchen board excludes non-active tickets (tests/restaurants.test.ts,
  model after existing VAL-REST tests in the same file).
- New: credit transactions respects `limit` arg (tests/credit.test.ts, model
  after VAL-CRED-003's structure).
- Regression: full `bun test tests/*.test.ts` unchanged otherwise.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun test tests/*.test.ts` passes with 2+ new tests
- [ ] `grep -n "kitchenBoard" src/zero/queries.ts` shows a ticket-level status filter (or whereExists on open order)
- [ ] `grep -A3 "transactions: defineQuery" src/zero/queries.ts` shows a `.limit(`
- [ ] `git status` clean outside in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- ZQL in this Zero version (`@rocicorp/zero@^1.5.0`) supports neither
  `"IN"` comparisons nor `whereExists` on the ticket query — report the
  exact API error instead of restructuring the query layer.
- The kitchen board UI renders tickets in statuses other than the ones you
  filtered (visible in `buildKitchenBoard`) — report the full status list.
- Any existing VAL-* test fails after your change and the fix isn't an
  obvious test-data adjustment.
- You find the credit UI depends on having ALL transactions client-side
  (e.g. computes a lifetime aggregate from them) — a limit would silently
  change displayed numbers; report instead.

## Maintenance notes

- If a "ticket history" view is ever added, it needs its own paginated query
  — do not widen `kitchenBoard` back.
- `shifts.list` still replicates each shift's full payment graph (bounded
  only by page size 50). That redesign (persisted summaries) is deliberately
  deferred; see plans/README.md findings table.
- Reviewers should check that no org-scoping `.where` was altered.
