# Plan 004: Tell the cashier when the receipt failed to print

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d97b06e..HEAD -- features/pos/hooks/use-pos-checkout.ts features/pos/pos-page-context.tsx pages/+Layout.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d97b06e`, 2026-06-10

## Why this matters

When a sale is created, the POS triggers receipt printing through an
`onSaleCreated` callback. If printing fails (printer off, QZ Tray not
running, USB permission lost), the rejection is caught and written to
`console.error` only — the cashier sees a normal success flow with no
receipt and no explanation. In a thermal-printer retail environment this is
a real operational failure: the customer is waiting for a ticket and the
cashier has no idea anything went wrong, nor that they should use a reprint
path. The fix is small: surface the failure as a visible toast. The cart
SHOULD still clear — the sale itself succeeded; only the notification is
missing.

## Current state

- `features/pos/hooks/use-pos-checkout.ts:259-278` (`handleQuickSale`) and
  `:325-342` (`handleFinalizeSale`) both contain this pattern inside
  `createSaleMutation.mutate(payload, { onSuccess: ... })`:

  ```ts
  Promise.resolve(
    onSaleCreated?.({
      result,
      snapshot: receiptSnapshot,
    })
  ).catch((error) => {
    console.error("No se pudo imprimir el ticket de venta", error);
  });

  clearCart();           // (quick-sale variant; finalize also calls closeCheckoutModal())
  resetDeliveryInfo();
  ...
  ```

- The callback is wired in `features/pos/pos-page-context.tsx:301-312`,
  where `onSaleCreated` runs `printSaleReceipt(...)`.
- Toast infrastructure exists and is mounted globally: `pages/+Layout.tsx:6`
  imports `Toaster` from `@/components/ui/sonner` and renders
  `<Toaster richColors />` at `pages/+Layout.tsx:279`. An exemplar of toast
  usage in this repo: `features/products/components/kardex-export-button.tsx`
  (imports `toast` from `"sonner"`).
- Repo conventions: Ultracite/Biome forbids leftover `console.error` in
  committed client code (`AGENTS.md` "Code Quality"); UI strings in this
  area are Spanish (see the existing message text).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/pos-checkout.test.ts tests/pos.test.ts` | all pass |

## Scope

**In scope**:
- `features/pos/hooks/use-pos-checkout.ts` (the two catch blocks)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `features/pos/pos-page-context.tsx` / `printSaleReceipt` internals — the
  print pipeline itself is not being changed.
- Cart-clearing behavior — the sale succeeded; do NOT make cart clearing
  conditional on print success (that would let a cashier accidentally
  re-submit the same sale).
- Adding a reprint button/flow — bigger UX change, deferred (see
  Maintenance notes).
- `features/posv2/**`.

## Git workflow

- Branch: `advisor/004-surface-print-failures`
- Conventional commit, e.g. `fix(pos): show toast when receipt printing fails`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace the silent catches with a visible toast

In `features/pos/hooks/use-pos-checkout.ts`:

1. Add `import { toast } from "sonner";` (match the import style of
   `features/products/components/kardex-export-button.tsx`).
2. In BOTH catch blocks (lines ~266-268 and ~332-334), replace the
   `console.error(...)` with:

   ```ts
   toast.error("La venta se registró, pero no se pudo imprimir el ticket", {
     description:
       error instanceof Error ? error.message : "Revisa la impresora e intenta reimprimir.",
   });
   ```

   Keep the `.catch` structure; do not let the rejection escape (the sale
   succeeded — an unhandled rejection here would be wrong).
3. Consider extracting the shared handler into a small local function
   (`notifyPrintFailure(error: unknown)`) since the block now appears twice
   — match the file's existing helper style (plain functions above the
   hook).

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0; `grep -n "console.error" features/pos/hooks/use-pos-checkout.ts` →
no matches.

### Step 2: Run the POS test suites

These tests exercise checkout logic against a real DB; they don't render the
toast but will catch any accidental behavioral change.

**Verify**: `docker compose up -d postgres && bun test tests/pos-checkout.test.ts tests/pos.test.ts tests/pos-receipt.test.ts` → all pass.

## Test plan

No new automated test: the change is a UI side effect inside a React
callback, and this repo's unit layer is DB-integration-shaped (no
React-render test harness exists — do not introduce one for this). Manual
verification path (optional, requires running app): trigger a sale with no
printer configured and confirm the toast appears.

## Done criteria

- [ ] `grep -c "toast.error" features/pos/hooks/use-pos-checkout.ts` ≥ 1 (shared helper) and `grep -c "console.error" features/pos/hooks/use-pos-checkout.ts` = 0
- [ ] `bunx tsc --noEmit` exits 0; `bun run check` exits 0
- [ ] `bun test tests/pos-checkout.test.ts tests/pos.test.ts tests/pos-receipt.test.ts` all pass
- [ ] `git status` clean outside in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `use-pos-checkout.ts` no longer contains the two catch blocks shown in
  Current state (drift).
- Importing `toast` from `"sonner"` inside a hook file trips a lint rule or
  a Vike client/server boundary error — report the exact error; do not
  restructure the hook to work around it.
- You find an existing in-app notification convention OTHER than sonner used
  inside `features/pos/**` — match that instead, and say so in your report.

## Maintenance notes

- Deferred follow-up: a "reprint last receipt" affordance (the
  `receiptSnapshot` built in both handlers is exactly the data a reprint
  needs — someone could stash the last snapshot in the POS context).
- If checkout is ever unified with `features/posv2`, carry this toast over.
- Reviewers: confirm cart clearing still happens unconditionally on sale
  success.
