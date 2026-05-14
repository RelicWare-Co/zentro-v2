# Worker Batch 9 Output

## File Fixed
- `server/orpc/routers/sales.ts`

## Errors Fixed
1. **lint/complexity/noExcessiveCognitiveComplexity** at line 102 (list handler)
   - Extracted `buildSalesWhereConditions` helper function to move all `if` blocks and ternaries for constructing SQL `WHERE` clauses out of the `list` handler.
   - The handler now calls `buildSalesWhereConditions(organizationId, filters, paidAmountExpression)` instead of building conditions inline.

2. **lint/complexity/noExcessiveCognitiveComplexity** at line 659 (cancel transaction callback)
   - Extracted five helper functions:
     - `fetchAndValidateCancellationTarget` – queries the target sale and its shift, runs all validation checks, and returns the sale.
     - `validateCreditTransactionRules` – validates that a sale has no payments and, if credit, has charge transactions.
     - `buildStockRestorations` – builds the `Map` of stock to restore from sale items and modifiers.
     - `restoreProductStock` – runs the `Promise.all` of `UPDATE product` queries and returns restore results.
     - `reverseCreditCharges` – runs the `Promise.all` of credit-account balance reversals.
   - The transaction callback now coordinates these helpers, keeping only the `entriesToRestore` loop, inventory-rows insert guard, and final sale update.

3. **lint/suspicious/noEvolvingTypes** at line 835 (`entriesToRestore`)
   - Added an explicit type annotation to `entriesToRestore`:
     ```ts
     const entriesToRestore: Array<{
       productId: string;
       restoration: {
         quantity: number;
         productName: string;
         trackInventory: boolean;
       };
     }> = [];
     ```

## Verification
Ran `bunx biome check --max-diagnostics=50 server/orpc/routers/sales.ts` – **0 errors, 0 warnings**.

## Notes
- No logic or behavior was changed; only code was reorganized into helpers.
- Types were preserved. The `SQL<number>` type was imported from `drizzle-orm` for the helper signature.
- No new TypeScript or lint errors were introduced.
