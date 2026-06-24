# Sonner Test DOM Shim

## Symptom

`bun test tests/pos-checkout.test.ts` failed before executing its assertions.
Loading `use-pos-checkout.ts` imported Sonner, whose CSS bootstrap called
`document.getElementsByTagName` on Bun's test DOM shim.

## Cause

`tests/helpers/dom-shim.ts` created a partial global `document` for overlay
tests. Its presence made Sonner treat the test process as a browser, but the
shim did not provide the `head`, `createTextNode`, or append-child surface used
by Sonner's module-level CSS insertion.

Sonner remains an active dependency: it is used by the global toaster and POS,
admin, and product notifications. Removing it would break production behavior.

## Solution

Extended the test-only DOM shim with a minimal `head`, `createElement`, and
`createTextNode` implementation sufficient for stylesheet insertion. The shim
continues to avoid a heavyweight DOM dependency.

## Verification

- `bun test tests/pos-checkout.test.ts`
- `bun test`
- `bunx tsc --noEmit`
- `bun run check`
