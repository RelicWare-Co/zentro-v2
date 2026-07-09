# Plan 014: Replace `console.error` in `print-thermal-receipt.client.tsx` with a user-visible notification

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/pos/printing/print-thermal-receipt.client.tsx`
> If the in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

`features/pos/printing/print-thermal-receipt.client.tsx:28` uses `console.error`
to log a thermal-printer failure before falling back to PDF. This violates
`AGENTS.md` ("Do not leave `console.log`, `debugger`, or `alert` in production
code"). More importantly, the cashier gets no visible feedback that the
thermal printer failed and the system fell back to PDF — they may wait for a
ticket that will never print. The fix is to surface the fallback as a toast
notification (the repo already uses `sonner` for this — see plan 004 which
added toast notifications for print failures in `use-pos-checkout.ts`).

## Current state

- `features/pos/printing/print-thermal-receipt.client.tsx:24-33`:
  ```ts
  try {
    await getPosPrinterManager().printReceipt(document, organizationId);
    return true;
  } catch (error) {
    console.error(
      "No se pudo imprimir en impresora POS, fallback a PDF",
      error
    );
    return printReceiptAsPdf(document, settings);
  }
  ```
- Toast infrastructure: `sonner` is used throughout the codebase. Example:
  `features/products/components/kardex-export-button.tsx` imports `toast` from
  `"sonner"`. Plan 004 added `toast.error(...)` in
  `features/pos/hooks/use-pos-checkout.ts` for the same class of failure.
- This is a `.client.tsx` file — it can safely import `toast` from `"sonner"`.
- The fallback to PDF (`printReceiptAsPdf`) should still execute — the toast
  is informational, not a blocking error.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/pos-receipt.test.ts` | all pass |

## Scope

**In scope**:
- `features/pos/printing/print-thermal-receipt.client.tsx` (the `catch` block
  at line ~27-33)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `features/pos/hooks/use-pos-checkout.ts` — already fixed by plan 004.
- `printReceiptAsPdf` internals — the PDF fallback pipeline is not changing.
- The `printPosPrinterTestDocument` function at line 132 — it calls
  `printThermalReceipt` which will now show the toast; no separate change needed.

## Git workflow

- Branch: `advisor/014-replace-console-error-print-thermal`
- Conventional commit, e.g. `fix(pos): show toast on thermal printer fallback to PDF`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace `console.error` with a toast notification

In `features/pos/printing/print-thermal-receipt.client.tsx`:

1. Add `import { toast } from "sonner";` at the top of the file (match the
   import style of `features/products/components/kardex-export-button.tsx`).
2. In the `catch` block (lines ~27-33), replace the `console.error(...)` with:

   ```ts
   toast.warning("Impresora térmica no disponible", {
     description:
       error instanceof Error
         ? error.message
         : "Se generará un PDF como respaldo.",
   });
   ```

   Use `toast.warning` (not `toast.error`) because the operation still
   succeeds via PDF fallback — it's a degraded-mode notification, not a
   failure. Keep the `return printReceiptAsPdf(document, settings);` call
   after the toast.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0; `grep -n "console.error" features/pos/printing/print-thermal-receipt.client.tsx`
→ no matches.

### Step 2: Run the receipt test suite

**Verify**: `docker compose up -d postgres && bun test tests/pos-receipt.test.ts` → all pass.

## Test plan

No new automated test — the change is a UI side effect inside a client-only
print function. Manual verification path (optional): trigger a print with no
thermal printer configured and confirm the toast appears before the PDF opens.

## Done criteria

- [ ] `grep -c "console.error" features/pos/printing/print-thermal-receipt.client.tsx` = 0
- [ ] `grep -c "toast" features/pos/printing/print-thermal-receipt.client.tsx` ≥ 1
- [ ] `bunx tsc --noEmit` exits 0; `bun run check` exits 0
- [ ] `bun test tests/pos-receipt.test.ts` all pass
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `print-thermal-receipt.client.tsx` no longer contains the `console.error` in
  the catch block (drift — someone already fixed it).
- Importing `toast` from `"sonner"` inside a `.client.tsx` file trips a lint
  rule or Vike boundary error — report the exact error.
- You find an existing notification convention in `features/pos/printing/`
  OTHER than sonner — match that instead, and say so in your report.

## Maintenance notes

- Plan 004 already handles the `console.error` → toast conversion in
  `use-pos-checkout.ts` (the checkout-level print failure). This plan handles
  the lower-level `printThermalReceipt` function. Together they provide
  complete user-visible print failure coverage.
- If `posv2` ever replaces `pos`, verify that `posv2` also calls
  `printThermalReceipt` (it likely does via the shared printing module).
