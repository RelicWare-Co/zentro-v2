# Plan 003: Enforce the stock invariant in the sale path and back money invariants with DB constraints

> **⚠ SUPERSEDED (2026-07-03)**: The product decision was made to allow
> overselling — tracked product stock can now go negative for both sales and
> manual inventory movements. The stock non-negativity guards were removed from
> `applyInventoryDeltas`, `products.mutators.server.ts`, and
> `products.mutators.ts`. A `"debt"` stock status was added to the UI to display
> negative stock clearly. This plan is retained for historical context but
> should not be executed as-is.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-test-gate-and-ci.md
- **Category**: bug
- **Planned at**: commit `d97b06e`, 2026-06-10

## Why this matters

The codebase enforces "stock never goes negative" in one place and not the
other. Manual inventory movements reject any movement that would drive stock
below zero (`src/zero/mutators.ts:883-888`, error "Stock insuficiente para
…"). But the sale path decrements stock with a plain
`stock = stock + delta` UPDATE and no guard
(`server/sales/create-sale.server.ts:588-610`), so concurrent or oversized
sales can push a tracked product negative — after which the inventory module
refuses legitimate corrections ("waste" on a negative-stock product throws).
There is also no database CHECK constraint on `product.stock` or
`credit_account.balance`, so any future code path that forgets the
application-level guard can silently corrupt money/inventory data.

## Current state

- `server/sales/create-sale.server.ts:299-390` — `buildPreparedItems()`
  computes `stockDeltas` per product; no stock sufficiency check.
- `server/sales/create-sale.server.ts:559-628` — `updateInventory()` runs:

  ```ts
  tx.update(product)
    .set({ stock: sql`${product.stock} + ${deltaQuantity}` })
    .where(and(
      eq(product.id, productId),
      eq(product.organizationId, organizationId),
      isNull(product.deletedAt)
    ))
    .returning({ id: product.id })
  ```

  and throws `No fue posible actualizar el stock de <name>` only when zero
  rows matched. `deltaQuantity` is negative for sales. Only products with
  `trackInventory` true reach this update (line 582 skips others).

- The whole sale runs inside one Drizzle transaction: `createCoreSale`
  (`server/sales/create-sale.server.ts:827-843`) wraps `runCreateSale` in
  `.transaction(...)`, and the Zero server mutator path passes Zero's
  wrapped transaction (`src/zero/mutators.server.ts:119-130`). A thrown
  error rolls back the entire sale — safe to add guards.

- The invariant exemplar to match — `src/zero/mutators.ts:875-888`
  (`registerInventoryMovement`):

  ```ts
  const nextStock = currentStock + deltaQuantity;
  if (nextStock < 0) {
    throw new Error(
      `Stock insuficiente para ${targetProduct.name}. Disponible: ${currentStock}`
    );
  }
  ```

- The atomic-guard exemplar already used for money —
  `server/credit/register-payment.server.ts` and
  `server/sales/cancel-sale.server.ts:208-227` guard balance decrements with
  a `gte(creditAccount.balance, amount)` condition in the UPDATE's WHERE and
  treat 0 updated rows as failure. Use the same pattern for stock.

- Schema: `database/drizzle/schema/inventory.schema.ts:48-49`:

  ```ts
  trackInventory: boolean("track_inventory").default(true).notNull(),
  stock: integer("stock").default(0).notNull(), // Cache del stock actual
  ```

  `database/drizzle/schema/credit.schema.ts:23`:

  ```ts
  balance: integer("balance").notNull().default(0), // Positivo = El cliente debe dinero
  ```

  Migrations live in `database/migrations/` (latest:
  `0004_gorgeous_chamber.sql`) and are generated with `bun run db:generate`
  (drizzle-kit). `AGENTS.md` requires `bun run zero:schema:gen` after ANY
  change to `database/drizzle/schema/*.schema.ts`.

- Client-side note: the optimistic client mutator for sales is a no-op
  (`src/zero/mutators.ts:967-973` — `create: defineMutator(..., async () => {})`);
  the server implementation is authoritative, so the guard belongs only in
  `create-sale.server.ts`.

- Tests: `tests/pos.test.ts`, `tests/sales.test.ts` and
  `tests/inventory-stock-status.test.ts` cover sale creation and stock via a
  real Postgres (helpers in `tests/helpers/`). Follow their VAL-* naming.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run fix && bun run check` | exit 0 |
| Start DB | `docker compose up -d postgres` | healthy |
| Tests | `bun test tests/*.test.ts` | all pass |
| Gen migration | `bun run db:generate` | new SQL file in `database/migrations/` |
| Apply migration | `bun run db:migrate` | exit 0 |
| Regen Zero schema | `bun run zero:schema:gen` | `src/zero/schema.gen.ts` regenerated |

## Scope

**In scope**:
- `server/sales/create-sale.server.ts` (the stock update guard)
- `database/drizzle/schema/inventory.schema.ts`,
  `database/drizzle/schema/credit.schema.ts` (CHECK constraints)
- `database/migrations/*` (generated — plus hand-added backfill, see Step 3)
- `src/zero/schema.gen.ts` (regenerated only, never hand-edited)
- `tests/sales.test.ts` or `tests/pos.test.ts` (new tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/zero/mutators.ts` `registerInventoryMovement` — already correct.
- `server/sales/cancel-sale.server.ts` — restoration adds stock; cannot
  violate the invariant.
- Any UI change (e.g. disabling the sell button at zero stock) — client UX
  is a separate concern; the POSv2 grid already shows "Sin Stock" badges.
- `drizzle-zero.config.ts`.

## Git workflow

- Branch: `advisor/003-stock-invariant`
- Conventional commits, e.g. `fix(sales): reject sales exceeding tracked stock`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the atomic stock guard to `updateInventory`

In `server/sales/create-sale.server.ts:588-610`, extend the UPDATE's WHERE
for negative deltas so the decrement only applies when sufficient stock
exists, mirroring the `gte` guard pattern from
`cancel-sale.server.ts:208-227`:

```ts
.where(and(
  eq(product.id, productId),
  eq(product.organizationId, organizationId),
  isNull(product.deletedAt),
  // only guard decrements; restocks/positive deltas always apply
  ...(deltaQuantity < 0
    ? [gte(product.stock, -deltaQuantity)]
    : [])
))
```

When zero rows match for a negative delta, throw the same user-facing error
shape the inventory module uses:
`Stock insuficiente para ${productRow.name}` (you cannot cheaply include
"Disponible: N" here without an extra read — the name-only message is
acceptable; keep it in Spanish like every other error in this file).
Import `gte` from `drizzle-orm` alongside the existing `and, eq, isNull`
imports.

Note the existing error branch at lines 601-606 currently means "product
disappeared"; after this change zero-rows means *either* missing product or
insufficient stock for decrements. Distinguish them: for negative deltas
throw the insufficient-stock message; keep the old message for positive
deltas.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Add tests for the new rejection

In `tests/sales.test.ts` (model after the existing VAL-SALE-* tests in that
file — they build an org, products, and call sale creation through the Zero
helpers in `tests/helpers/`):

1. Product with `trackInventory: true`, `stock: 1`; create a sale of
   quantity 2 → expect rejection with message containing
   `Stock insuficiente`, AND assert afterwards the product's stock is still
   1 and no `sale` row was inserted (query the test DB — see how
   VAL-CRED-003 in `tests/credit.test.ts:284-320` verifies state after
   mutation).
2. Product with `trackInventory: false`, `stock: 0`; sale of quantity 5 →
   succeeds (untracked products are exempt — line 582 behavior preserved).
3. Product with `stock: 2`, sale of quantity 2 → succeeds, stock lands at 0.

**Verify**: `bun test tests/sales.test.ts` → all pass including 3 new tests.

### Step 3: Add CHECK constraints as a database backstop

1. In `database/drizzle/schema/inventory.schema.ts`, add to the `product`
   table definition a check constraint
   `check("product_stock_non_negative", sql`${table.stock} >= 0 OR ${table.trackInventory} = false`)`
   — untracked products may legitimately hold negative cached values from
   historical data; only tracked stock is constrained. Use drizzle-orm's
   `check` from `drizzle-orm/pg-core` (verify how existing indexes/uniques
   are declared in this file's table callback and match the style).
2. In `database/drizzle/schema/credit.schema.ts`, add
   `check("credit_account_balance_non_negative", sql`${table.balance} >= 0`)`.
3. Run `bun run db:generate` to produce the migration. **Then edit the
   generated SQL** to backfill before the constraint is applied:

   ```sql
   UPDATE "product" SET "stock" = 0 WHERE "stock" < 0 AND "track_inventory" = true;
   ```

   placed before the `ALTER TABLE ... ADD CONSTRAINT`. (If any production
   row is negative, the constraint would otherwise fail to apply. Zeroing is
   the documented remediation; record affected counts in your report.) Do
   the same defensive backfill for `credit_account.balance < 0`.
4. Run `bun run db:migrate` against the local DB, then
   `bun run zero:schema:gen` (required by AGENTS.md after any schema change).

**Verify**: `bun run db:migrate` → exit 0;
`git diff --stat src/zero/schema.gen.ts` shows regeneration (may be empty if
checks don't surface in Zero schema — that's fine);
`bun test tests/*.test.ts` → all pass.

### Step 4: Full gate

**Verify**: `bun run fix && bun run check` → exit 0; `bunx tsc --noEmit` →
exit 0; `bun test tests/*.test.ts` → all pass.

## Test plan

- 3 new tests in `tests/sales.test.ts` (Step 2 list: rejection, untracked
  exemption, exact-stock success), modeled structurally on existing
  VAL-SALE-* tests and the state-assertion style of
  `tests/credit.test.ts` VAL-CRED-003.
- Existing suites (`tests/pos.test.ts`,
  `tests/inventory-stock-status.test.ts`) must pass unchanged — if any
  existing test seeds a sale that oversells tracked stock, that test
  *encodes the old behavior*; see STOP conditions before "fixing" it.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0; `bun run check` exits 0
- [ ] `bun test tests/*.test.ts` passes, including 3 new tests
- [ ] `grep -n "gte(product.stock" server/sales/create-sale.server.ts` returns a match
- [ ] A new migration file exists in `database/migrations/` containing both CHECK constraints and the backfill UPDATEs
- [ ] `git status` clean outside in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Any existing test intentionally creates a sale that drives tracked stock
  negative (search `tests/` for seeds with low stock + larger quantity) —
  that means overselling may be deliberate product behavior, and the
  maintainer must confirm the decision before this plan proceeds.
- The POS UI offers an explicit "sell without stock" flow you can find
  (grep `features/pos features/posv2` for stock-bypass affordances) — same
  reason.
- drizzle-kit cannot express the CHECK constraint in this drizzle-orm
  version (`drizzle-orm@^0.45.2`) — report rather than hand-writing
  schema-drifted SQL.
- The local migration fails on the backfill (e.g. permissions) twice.

## Maintenance notes

- Any future bulk-import or sync path that writes `product.stock` directly
  must respect the constraint; the DB will now reject violations loudly.
- If the business later wants configurable overselling, the right shape is
  an org setting (cf. `getOrganizationSettingsFromTx`,
  `src/zero/mutators.ts:315-325`) that relaxes the guard in
  `updateInventory` — the CHECK constraint would then need
  `OR track_inventory = false`-style relaxation too; revisit both together.
- Reviewers: scrutinize the migration's backfill counts in the PR
  description, and that the guard applies only to negative deltas.
