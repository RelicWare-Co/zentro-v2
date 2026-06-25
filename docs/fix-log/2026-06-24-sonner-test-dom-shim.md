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

Sonner was removed on 2026-06-24. All `toast.x()` calls were migrated to
`@mantine/notifications` (`notifications.show({ ... })`). The `<Notifications />`
component is mounted in `pages/+Layout.tsx`. The DOM shim extensions added for
sonner's CSS bootstrap are no longer needed but were left in place harmlessly.

## Solution

Extended the test-only DOM shim with a minimal `head`, `createElement`, and
`createTextNode` implementation sufficient for stylesheet insertion. The shim
continues to avoid a heavyweight DOM dependency.

## Verification

- `bun test tests/pos-checkout.test.ts`
- `bun test`
- `bunx tsc --noEmit`
- `bun run check`
