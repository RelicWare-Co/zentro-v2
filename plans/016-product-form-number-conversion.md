# Plan 016: Replace `Number(...) || 0` with normalized helpers in the product form

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/products/components/product-form-sheet.tsx features/products/products-form.shared.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 008 (typecheck gate must be green to verify changes)
- **Category**: correctness
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

`features/products/components/product-form-sheet.tsx:98-99` uses
`Number(form.taxRate) || 0` and `Number(form.stock) || 0` to convert form
string values to numbers. This pattern silently converts invalid input
(`NaN`, empty string, `"abc"`) to `0`, which means a cashier who accidentally
types a non-numeric tax rate gets `0%` tax instead of a validation error.
A product with `0%` tax when it should have `19%` causes incorrect sale totals
and tax accounting downstream.

The repo already has a canonical `parseMoneyInput` helper in `lib/utils.ts`
that handles string-to-number conversion safely (strips non-digits, rounds,
clamps to non-negative). The product form already imports it (line 22) and
uses it for `price` and `cost` (lines 96-97). The `taxRate` and `stock` fields
should use the same helper or a domain-appropriate alternative.

## Current state

- `features/products/components/product-form-sheet.tsx:96-99`:
  ```ts
  price: isIngredient ? 0 : parseMoneyInput(form.price),
  cost: parseMoneyInput(form.cost),
  taxRate: Number(form.taxRate) || 0,
  ...(product ? {} : { stock: Number(form.stock) || 0 }),
  ```
- The form already imports `parseMoneyInput`, `sanitizeMoneyInput`,
  `formatMoneyInput`, and `getErrorMessage` from `@/lib/utils` (line 18-23).
- `parseMoneyInput` in `lib/utils.ts:17-35` handles `string | number | null |
  undefined`, strips non-digits, rounds, and clamps to `>= 0`. It returns `0`
  for invalid input — same fallback as `Number(...) || 0` but with explicit
  sanitization of non-numeric characters first.
- `AGENTS.md` points to `lib/domain-values.shared.ts` as the canonical source
  for `normalizeNumber`, `toNonNegativeInteger`, `toInteger`, `toPositiveInteger`.
  These may be more appropriate for `taxRate` (which is a percentage, not
  money) and `stock` (which is a non-negative integer).
- `form.taxRate` is a string field representing a percentage (0-100).
  `parseMoneyInput` would work but semantically `normalizeNumber` or
  `toNonNegativeInteger` from `lib/domain-values.shared.ts` may be clearer.
- `form.stock` is a string field representing a non-negative integer quantity.
  `toNonNegativeInteger` from `lib/domain-values.shared.ts` is the most
  appropriate helper.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/products.test.ts` | all pass |

## Scope

**In scope**:
- `features/products/components/product-form-sheet.tsx` (the
  `buildSaveProductPayload` function, lines ~84-112)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `lib/utils.ts` — `parseMoneyInput` is already correct; do not change it.
- `lib/domain-values.shared.ts` — the helpers are already defined; just import
  and use them.
- `features/products/products-form.shared.ts` — unless the form initial values
  also use `Number(...)` patterns (check and report, but do not fix in this
  plan unless trivially related).
- The product form validation logic — this plan fixes the conversion, not the
  validation UX. A follow-up could add inline validation for invalid tax/stock
  input.

## Git workflow

- Branch: `advisor/016-product-form-number-conversion`
- Conventional commit, e.g. `fix(products): use normalized helpers for taxRate and stock conversion`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Check available helpers in `lib/domain-values.shared.ts`

Read `lib/domain-values.shared.ts` to confirm `toNonNegativeInteger` and
`normalizeNumber` are available and understand their behavior:

```bash
grep -n "export function toNonNegativeInteger\|export function normalizeNumber" lib/domain-values.shared.ts
```

`toNonNegativeInteger` should parse a string to a non-negative integer (rounds
or truncates, clamps to `>= 0`, returns `0` for invalid input).
`normalizeNumber` should parse a string to a non-negative number (allows
decimals).

**Verify**: The helpers exist and are exported. If they don't exist or have
different signatures, STOP and report.

### Step 2: Replace `Number(form.taxRate) || 0` with a normalized helper

In `features/products/components/product-form-sheet.tsx`, line 98:

If `taxRate` should be an integer percentage (0, 5, 19, etc.):
```ts
taxRate: toNonNegativeInteger(form.taxRate),
```

If `taxRate` can be a decimal (e.g., 8.5%):
```ts
taxRate: normalizeNumber(form.taxRate),
```

Add the import from `@/lib/domain-values.shared` (or `@/zero/sdk` which
re-exports them per `AGENTS.md`):
```ts
import { toNonNegativeInteger, normalizeNumber } from "@/lib/domain-values.shared";
```

Check the existing `taxRate` values in the schema or test fixtures to
determine whether decimal tax rates are supported. If the schema uses an
integer column, use `toNonNegativeInteger`.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Replace `Number(form.stock) || 0` with `toNonNegativeInteger`

In `features/products/components/product-form-sheet.tsx`, line 99:

```ts
...(product ? {} : { stock: toNonNegativeInteger(form.stock) }),
```

`stock` is always a non-negative integer quantity, so `toNonNegativeInteger`
is the correct helper.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0.

### Step 4: Run the products test suite

**Verify**: `docker compose up -d postgres && bun test tests/products.test.ts` → all pass.

## Test plan

No new automated test — the conversion helpers are already tested via
`lib/domain-values.shared.ts` unit tests (if they exist) or via the product
integration tests that exercise the form submission path. Manual verification
path (optional): enter a non-numeric value in the tax rate field and confirm
the product saves with `0` tax (same fallback behavior, but now via the
canonical helper instead of ad-hoc `Number(...) || 0`).

## Done criteria

- [ ] `grep -c "Number(form" features/products/components/product-form-sheet.tsx` = 0
- [ ] `grep -c "toNonNegativeInteger\|normalizeNumber\|parseMoneyInput" features/products/components/product-form-sheet.tsx` ≥ 3 (price, cost, taxRate, stock all use normalized helpers)
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run check` exits 0
- [ ] `bun test tests/products.test.ts` all pass
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `toNonNegativeInteger` or `normalizeNumber` do not exist in
  `lib/domain-values.shared.ts` — report what helpers ARE available and
  suggest using `parseMoneyInput` from `lib/utils.ts` as a fallback.
- The `taxRate` column in the database schema is a float/decimal that requires
  decimal precision and `toNonNegativeInteger` would truncate it — use
  `normalizeNumber` instead and report the schema type.
- The product form has additional `Number(...)` conversions beyond lines 98-99
  that are in scope — report them but only fix the two documented sites in this
  plan.
- Any product integration test fails after the change — report the test name
  and assertion that broke.

## Maintenance notes

- This plan fixes the conversion but does not add inline form validation. A
  follow-up could add Mantine form validation to show an error when the tax
  rate or stock field contains non-numeric input, instead of silently
  converting to `0`.
- The `parseOptionalStockField` helper (already imported from
  `products-form.shared.ts` and used for `minStock` and `reorderQuantity` at
  lines 100-101) is the pattern to follow for optional stock fields. The
  required `stock` field on creation should use `toNonNegativeInteger` for
  consistency with the canonical helpers.
- If `posv2` ever replaces `pos`, verify that `posv2` does not have its own
  product form with the same `Number(...)` pattern.
