# Worker Batch 6 — Ultracite Lint Fixes

## Files Fixed

- `server/orpc/routers/credit.ts`
- `features/pos/components/product-grid.tsx`
- `server/orpc/routers/shifts.ts`

## Errors Fixed

### 1. `server/orpc/routers/credit.ts`
- **Rule:** `noExcessiveCognitiveComplexity` at `registerPayment` transaction callback
- **Fix:** Extracted 4 validation helpers at module level:
  - `validateShiftForPayment`
  - `validateEnabledPaymentMethod`
  - `fetchAndValidateCreditAccount`
  - `fetchAndValidateSaleForPayment`
- The transaction callback now delegates to these helpers, reducing its cognitive complexity from 39 to well under the threshold.

### 2. `features/pos/components/product-grid.tsx`
- **Rule:** `noExcessiveCognitiveComplexity` at inline `onKeyDown` handler
- **Fix:** 
  - Extracted 6 module-level keyboard helpers: `shouldIgnoreKeyDown`, `isDeletionKey`, `tryHandleEscape`, `tryHandleEnter`, `tryHandleTab`, `updateScanMetrics`, `shouldScheduleScanner`
  - Replaced inline `onChange` and `onKeyDown` JSX handlers with `useCallback` hooks (`handleSearchChange`, `handleKeyDown`) that compose the helpers
  - Removed unused `key` parameter from `updateScanMetrics` to avoid `noUnusedVariables`

### 3. `server/orpc/routers/shifts.ts`
- **Rules:** 
  - `noExcessiveCognitiveComplexity` at `list` handler
  - `useDefaultSwitchClause` at `closeSummary` movement type switch
- **Fix:**
  - Added `default` clause to the `switch (movement.type)` in `closeSummary` that throws an `ORPCError` for unsupported movement types
  - Extracted `buildShiftWhereConditions` to move the 11 `if` branches for query filtering out of `list`
  - Added 4 interface types (`SaleAggregateRow`, `PaymentAggregateRow`, `MovementAggregateRow`, `ClosureAggregateRow`) and 4 aggregation builders (`buildOperationsByShift`, `buildPaymentsByShift`, `buildMovementsByShift`, `buildClosuresByShift`)
  - Added `buildShiftMaps` composer function
  - Replaced the 4 inline aggregation `for` loops in `list` with a single call to `buildShiftMaps`
  - Added imports: `SQL` from `drizzle-orm`, `ListShiftsInputSchema`, and `z` from `zod`

## Verification

```bash
bunx biome check --max-diagnostics=50 \
  server/orpc/routers/credit.ts \
  features/pos/components/product-grid.tsx \
  server/orpc/routers/shifts.ts
```

**Result:** `Checked 3 files in 30ms. No fixes applied.` — zero errors.

LSP diagnostics (TypeScript) confirmed no errors in any of the 3 files after changes.
