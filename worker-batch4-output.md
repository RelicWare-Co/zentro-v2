# Worker Batch 4 — Ultracite Lint Fixes

## Summary
Fixed all ultracite errors in the 5 assigned files. Verified with `bunx biome check --max-diagnostics=50` — zero errors remain. No new TypeScript or lint errors introduced.

---

## Files Fixed

### 1. `server/orpc/routers/restaurants.ts`
**Error:** `lint/style/noNestedTernary` at line ~695
- **Fix:** Refactored the nested ternary that computed `nextStatus` into an explicit `if/else` block with a `let` variable.
- **Before:**
  ```ts
  const nextStatus = activeStatuses.every((status) => status === "served")
    ? "served"
    : activeStatuses.every(
          (status) => status === "ready" || status === "served"
        )
      ? "ready"
      : "sent";
  ```
- **After:**
  ```ts
  let nextStatus: "served" | "ready" | "sent";
  if (activeStatuses.every((status) => status === "served")) {
    nextStatus = "served";
  } else if (
    activeStatuses.every((status) => status === "ready" || status === "served")
  ) {
    nextStatus = "ready";
  } else {
    nextStatus = "sent";
  }
  ```

---

### 2. `server/hono.ts`
**Error:** `lint/suspicious/noExplicitAny` at line 38
- **Fix:** Replaced `as any` with `as ContentfulStatusCode` and added the corresponding import from `hono/utils/http-status`.
- **Before:**
  ```ts
  (parsed.status as any) ?? 500
  ```
- **After:**
  ```ts
  import type { ContentfulStatusCode } from "hono/utils/http-status";
  // ...
  (parsed.status as ContentfulStatusCode) ?? 500
  ```

---

### 3. `global.d.ts`
**Error:** `lint/style/noNamespace` at line 5
- **Fix:** Added a `// biome-ignore` comment. Vike’s type system fundamentally requires augmenting the global `Vike` namespace (the library itself declares `declare global { namespace Vike { ... } }`), so it is not possible to refactor this to module declarations or interfaces without breaking type merging.
- **Before:**
  ```ts
  declare global {
    namespace Vike {
  ```
- **After:**
  ```ts
  declare global {
    // biome-ignore lint/style/noNamespace: Vike requires namespace augmentation for global type merging
    namespace Vike {
  ```

---

### 4. `features/pos/printing/printer-settings.local.client.ts`
**Error:** `lint/suspicious/noEmptyBlockStatements` at line 411
- **Fix:** Replaced the empty arrow-function block `() => {}` with `() => undefined`.
- **Before:**
  ```ts
  return () => {};
  ```
- **After:**
  ```ts
  return () => undefined;
  ```

---

### 5. `features/pos/printing/printer-manager.client.ts`
**Error:** `lint/style/noNestedTernary` at line 459
- **Fix:** Extracted the nested ternary for `language` into a `let` variable with an `if/else` block before the `this.setState` call.
- **Before:**
  ```ts
  language: isPosEncodablePrinterLanguage(payload.language)
    ? payload.language
    : isPosEncodablePrinterLanguage(savedDevice.language)
      ? savedDevice.language
      : null,
  ```
- **After:**
  ```ts
  let resolvedLanguage: EncodablePrinterLanguage | null = null;
  if (isPosEncodablePrinterLanguage(payload.language)) {
    resolvedLanguage = payload.language;
  } else if (isPosEncodablePrinterLanguage(savedDevice.language)) {
    resolvedLanguage = savedDevice.language;
  }
  // ...
  language: resolvedLanguage,
  ```

---

## Additional Fix (Cascade Error)

A TypeScript cascade error (`TS2322`) was flagged in `features/settings/components/local-printer-settings-card.client.tsx` because `reconnectPosPrinter` returned `false | Promise<boolean>` instead of `Promise<unknown>`. To fix the root cause, I made `reconnectPosPrinter` `async` in `features/pos/printing/print-thermal-receipt.client.tsx` so it always returns `Promise<boolean>`.

---

## Verification

```bash
bunx biome check --max-diagnostics=50 \
  server/orpc/routers/restaurants.ts \
  server/hono.ts \
  global.d.ts \
  features/pos/printing/printer-settings.local.client.ts \
  features/pos/printing/printer-manager.client.ts
```

**Result:** `Checked 5 files in 27ms. No fixes applied.` ✅

No TypeScript errors were introduced in the 5 assigned files.
