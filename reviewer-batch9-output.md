# Reviewer Report — Batch 9 (server/orpc/routers/sales.ts)

## Summary
- **Biome lint errors remaining:** 0
- **TypeScript regressions introduced:** 8
- **Logic concerns:** None — the refactored helpers preserve the exact same runtime semantics as the original inline code.
- **Original errors fixed:** The extraction of `buildSalesWhereConditions` and the cancellation helper functions appears to have been done to reduce function cognitive complexity (likely Ultracite/Biome `noExcessiveCognitiveComplexity`). The `type SQL` import was correctly added.
- **New errors introduced:** Type-only regressions caused by overly narrow types in extracted function signatures.

## Verdict: **FAIL**

---

## Detailed Issues

### 1. `buildSalesWhereConditions` parameter types are too narrow (5 errors)
**File:** `server/orpc/routers/sales.ts`  
**Lines:** 212, 213, 214, 215, 216

The extracted `buildSalesWhereConditions` function declares these properties as `string | undefined`:

```ts
function buildSalesWhereConditions(
  organizationId: string,
  filters: {
    status?: string;        // line 212 error
    cashierId?: string;     // line 213 error
    terminalName?: string;  // line 214 error
    paymentMethod?: string; // line 215 error
    balanceStatus?: string; // line 216 error
    ...
  },
  ...
)
```

But the caller passes `input.status`, `input.cashierId`, etc., which are typed as `string | null | undefined` (or specific enum unions that include `null`).

**Errors:**
```
TS2322: Type '"completed" | "credit" | "cancelled" | null | undefined' is not assignable to type 'string | undefined'.
TS2322: Type 'string | null | undefined' is not assignable to type 'string | undefined'.
```

**Fix:** Change the parameter types to accept `null`:
```ts
status?: string | null;
cashierId?: string | null;
terminalName?: string | null;
paymentMethod?: string | null;
balanceStatus?: string | null;
```

---

### 2. Extracted transaction helpers accept `AppContext["db"]` instead of transaction type (3 errors)
**File:** `server/orpc/routers/sales.ts`

The helpers `fetchAndValidateCancellationTarget`, `restoreProductStock`, and `reverseCreditCharges` all type their first parameter as `tx: AppContext["db"]`. `AppContext["db"]` resolves to `LibSQLDatabase<...> & { $client: Client }`, which has a required `batch` property. Inside the `cancel` handler, the actual `tx` object is a `SQLiteTransaction`, which does **not** have `batch`.

**Errors:**

#### Line 925
```
TS2345: Argument of type 'SQLiteTransaction<...>' is not assignable to parameter of type 'LibSQLDatabase<...> & { $client: Client; }'.
Property 'batch' is missing in type 'SQLiteTransaction<...>'.
```
- **Context:** `fetchAndValidateCancellationTarget(tx, input.saleId, organizationId, userId)` inside `cancel` transaction.
- **Fix:** Use `type DbTransaction = Parameters<Parameters<AppContext["db"]["transaction"]>[0]>[0];` (same pattern already used in `server/orpc/routers/credit.ts`) for the `tx` parameter type in all three extracted helpers.

#### Line 1039
Same `SQLiteTransaction` type error for:
- **Context:** `restoreProductStock(tx, entriesToRestore, organizationId)` inside `cancel` transaction.
- **Fix:** Same as above — change parameter type to `DbTransaction`.

#### Line 1061
Same `SQLiteTransaction` type error for:
- **Context:** `reverseCreditCharges(tx, chargeTransactions, organizationId, cancelledAt)` inside `cancel` transaction.
- **Fix:** Same as above — change parameter type to `DbTransaction`.

---

## How to Fix

1. Add a transaction alias at the top of `server/orpc/routers/sales.ts` (after imports):
```ts
type DbTransaction = Parameters<Parameters<AppContext["db"]["transaction"]>[0]>[0];
```

2. Update `buildSalesWhereConditions` optional string properties to allow `null`:
```ts
function buildSalesWhereConditions(
  organizationId: string,
  filters: {
    status?: string | null;
    cashierId?: string | null;
    terminalName?: string | null;
    paymentMethod?: string | null;
    balanceStatus?: string | null;
    trimmedSearchQuery?: string;
    startDateMs: number | null;
    endDateExclusiveMs: number | null;
    amountRange: { minimum: number | null; maximum: number | null };
  },
  paidAmountExpression: SQL<number>
)
```

3. Change the `tx` parameter type in the three cancellation helpers:
- `fetchAndValidateCancellationTarget(tx: DbTransaction, ...)`
- `restoreProductStock(tx: DbTransaction, ...)`
- `reverseCreditCharges(tx: DbTransaction, ...)`

---

*Reviewer note: The logic of the extracted functions is correct and matches the original inline behavior. The failures are purely type-level regressions introduced by the extraction.*
