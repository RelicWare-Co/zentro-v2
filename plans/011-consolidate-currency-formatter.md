# Plan 011: Consolidate the duplicated COP currency formatter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/pos/utils.ts features/products/products-formatters.shared.ts features/credit/credit-formatters.shared.ts features/dashboard/dashboard-formatters.shared.ts lib/utils.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 008 (typecheck gate)
- **Category**: debt
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

The same `new Intl.NumberFormat("es-CO", { style: "currency", currency:
"COP", maximumFractionDigits: 0 })` pattern is duplicated in 6+ locations.
This risks inconsistent formatting if one copy is changed without updating
the others, and violates DRY. A single canonical formatter in `lib/` removes
the drift surface and makes any future locale/precision change a one-line
edit.

## Current state

- `features/pos/utils.ts:10-14` — `currencyFormatter` + `export function
  formatCurrency(amount: number): string`. This is THE primary export,
  imported by ~29 files across `features/pos/`, `features/posv2/`,
  `features/shifts/`, `features/restaurants/`, `features/public-catalog/`,
  and `pages/(app)/pedidos/`.
- `features/products/products-formatters.shared.ts:1-9` — `currencyFormatter`
  + `export function formatProductCurrency(amount: number): string` — used by
  `features/products/components/products-table.tsx`.
- `features/credit/credit-formatters.shared.ts:1-5` — `export const
  creditCurrencyFormatter` — exported directly, used by credit components.
- `features/dashboard/dashboard-formatters.shared.ts:6-10` —
  `currencyFormatter` + `export function formatCurrency(value: number)` —
  used by dashboard components.
- `lib/utils.ts:8-11` — `moneyInputDisplayFormatter`. This is a DIFFERENT
  formatter (no `style: "currency"`, no `currency: "COP"`, just
  `maximumFractionDigits: 0, useGrouping: true`) — a money input display
  formatter, NOT a duplicate of the currency formatter. DO NOT consolidate
  this one.

Note: `features/pos/utils.ts` also exports `calculatePriceWithTax`,
`formatPaymentMethodLabel`, `createPaymentMethodLabelMap`,
`calculateCartTotals`, `calculateItemTotal`, `calculateItemBaseAmount`, and
`buildModifierFingerprint`. These are POS-specific and STAY in
`features/pos/utils.ts`. Only `formatCurrency` and the `currencyFormatter`
constant move.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/*.test.ts` | all pass |
| Duplication gone | `grep -rn "Intl.NumberFormat(\"es-CO\"" features/ lib/` | only `lib/format-currency.shared.ts` |

## Scope

**In scope**:
- `lib/format-currency.shared.ts` (create — canonical `formatCurrency` +
  `Intl.NumberFormat` instance)
- `features/pos/utils.ts` (remove `formatCurrency` + `currencyFormatter`,
  re-export `formatCurrency` from the new location to minimize import-site
  churn — OR update all ~29 import sites directly)
- `features/products/products-formatters.shared.ts` (remove
  `formatProductCurrency`, re-export `formatCurrency` or update
  `products-table.tsx` import)
- `features/credit/credit-formatters.shared.ts` (remove
  `creditCurrencyFormatter`, update credit components to import
  `formatCurrency` from the canonical location)
- `features/dashboard/dashboard-formatters.shared.ts` (remove local
  `formatCurrency` and `currencyFormatter`, re-export from canonical
  location)
- All import sites that reference these functions
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `lib/utils.ts` — `moneyInputDisplayFormatter` is a different formatter
  (no `style: "currency"`, no `currency: "COP"`); leave it alone.
- Any non-currency formatting functions in the same files (e.g. date
  formatters, label helpers).
- The POS-specific helpers in `features/pos/utils.ts`
  (`calculatePriceWithTax`, `formatPaymentMethodLabel`,
  `createPaymentMethodLabelMap`, `calculateCartTotals`,
  `calculateItemTotal`, `calculateItemBaseAmount`,
  `buildModifierFingerprint`) — these stay put.

## Git workflow

- Branch: `advisor/011-consolidate-currency-formatter`
- Conventional commit, e.g. `refactor(lib): consolidate duplicated COP currency formatter`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the canonical formatter

Create `lib/format-currency.shared.ts` (isomorphic, browser-safe) with the
canonical `Intl.NumberFormat` instance and a `formatCurrency` function:

```ts
const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
```

Match the exact `Intl.NumberFormat` config currently in
`features/pos/utils.ts:10-14` so output is byte-identical.

**Verify**: `bunx tsc --noEmit` → exit 0 (new file compiles in isolation).

### Step 2: Update `features/pos/utils.ts`

Remove the local `currencyFormatter` constant and `formatCurrency`
function. Re-export `formatCurrency` from the new location to minimize
import-site churn (the ~29 importers keep importing from
`@/features/pos/utils`):

```ts
export { formatCurrency } from "@/lib/format-currency.shared";
```

Keep all other POS-specific exports (`calculatePriceWithTax`,
`formatPaymentMethodLabel`, `createPaymentMethodLabelMap`,
`calculateCartTotals`, `calculateItemTotal`, `calculateItemBaseAmount`,
`buildModifierFingerprint`) untouched in this file.

**Verify**: `bunx tsc --noEmit` → exit 0; `grep -n "Intl.NumberFormat"
features/pos/utils.ts` → no matches.

### Step 3: Update `features/products/products-formatters.shared.ts`

Remove the local `currencyFormatter` and `formatProductCurrency`. Either
re-export `formatCurrency` as `formatProductCurrency` for backward
compatibility, OR update `features/products/components/products-table.tsx`
to import `formatCurrency` from `@/lib/format-currency.shared` directly.
Prefer the direct-import approach (fewer indirection layers) unless the
import site count is large.

**Verify**: `bunx tsc --noEmit` → exit 0; `grep -n "Intl.NumberFormat"
features/products/products-formatters.shared.ts` → no matches.

### Step 4: Update `features/credit/credit-formatters.shared.ts`

Remove `creditCurrencyFormatter`. Update credit components that imported
`creditCurrencyFormatter` to import `formatCurrency` from
`@/lib/format-currency.shared` and call `formatCurrency(amount)` instead of
`creditCurrencyFormatter.format(amount)`.

**Verify**: `bunx tsc --noEmit` → exit 0; `grep -n "Intl.NumberFormat"
features/credit/credit-formatters.shared.ts` → no matches.

### Step 5: Update `features/dashboard/dashboard-formatters.shared.ts`

Remove the local `currencyFormatter` constant and `formatCurrency`
function. Re-export `formatCurrency` from the canonical location (dashboard
components import from this file), OR update dashboard component imports
directly.

**Verify**: `bunx tsc --noEmit` → exit 0; `grep -n "Intl.NumberFormat"
features/dashboard/dashboard-formatters.shared.ts` → no matches.

### Step 6: Run typecheck, lint, and tests

**Verify**:
- `bunx tsc --noEmit` → exit 0, no output.
- `bun run fix && bun run check` → exit 0.
- `docker compose up -d postgres && bun test tests/*.test.ts` → all pass
  (formatting is pure; no behavioral change expected, but the POS/credit
  suites exercise code paths that call `formatCurrency`).
- `grep -rn "Intl.NumberFormat(\"es-CO\"" features/ lib/` → only
  `lib/format-currency.shared.ts` matches (the `lib/utils.ts`
  `moneyInputDisplayFormatter` uses a different config and must NOT
  appear here — if it does, the grep pattern is wrong, not the code).

## Test plan

No new automated tests. The formatter is a pure `Intl.NumberFormat` wrapper
with byte-identical config to the existing copies, so output is unchanged.
The existing POS/credit/dashboard integration tests exercise call sites and
will catch any accidental behavioral drift.

## Done criteria

- [ ] `grep -rn "Intl.NumberFormat(\"es-CO\"" features/ lib/` returns only
  `lib/format-currency.shared.ts`
- [ ] `lib/utils.ts` `moneyInputDisplayFormatter` is untouched (still
  present, still its own config)
- [ ] `bunx tsc --noEmit` exits 0 with no output
- [ ] `bun run check` exits 0
- [ ] `bun test tests/*.test.ts` all pass (Postgres up)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Any in-scope file has drifted from the "Current state" excerpts (run the
  drift check first) — compare line numbers and configs before proceeding.
- `features/pos/utils.ts` no longer exports `formatCurrency` (already
  consolidated?) — report and stop.
- An import site uses `formatCurrency` / `formatProductCurrency` /
  `creditCurrencyFormatter` with a signature or semantic that the canonical
  `formatCurrency(amount: number): string` does not satisfy (e.g. passing
  options, expecting a formatter instance rather than a string) — report
  the exact site; do not force-fit.
- `lib/utils.ts` `moneyInputDisplayFormatter` turns out to be a duplicate
  of the currency formatter after all (config changed to match) — report;
  do NOT consolidate it without confirmation, the plan explicitly excludes
  it.
- A re-export from `features/pos/utils.ts` trips a circular-import warning
  or a Vike client/server boundary error — report the exact error; do not
  restructure to work around it.

## Maintenance notes

- The re-export shim in `features/pos/utils.ts` exists only to avoid
  churning ~29 import sites. A future cleanup pass can update those
  importers to import directly from `@/lib/format-currency.shared` and drop
  the shim.
- `lib/utils.ts` `moneyInputDisplayFormatter` is intentionally left alone;
  it formats raw numeric input for display (no currency symbol) and serves
  a different purpose. If it ever needs currency styling, give it its own
  config — do not fold it into `formatCurrency`.
- If `features/posv2` ever supersedes `features/pos`, carry the canonical
  import over; the `lib/` location is stable across both.
- Reviewers: confirm `lib/utils.ts` is unchanged and that no
  `Intl.NumberFormat("es-CO", ...)` copy remains outside
  `lib/format-currency.shared.ts`.
