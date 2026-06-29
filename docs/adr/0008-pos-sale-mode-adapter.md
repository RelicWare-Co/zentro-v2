# ADR 0008: POS Sale Mode Adapter

## Status

Proposed

## Date

2026-06-29

## Context

The POS currently supports two sale modes: **counter** (direct cart → checkout → `createSale`) and **table** (restaurant table order → `sendToKitchen` / `closeTableOrder`). The switching logic is deeply woven into `pos-page-context.tsx`:

- `usePosTableOrder` is called unconditionally inside `PosPageProvider`, even when the restaurants module is disabled.
- `if (tableOrder.activeTableId)` branches appear in ~15 places: `addToCart`, `updateQuantity`, `removeFromCart`, `clearCart`, `updateItemDiscount`, `setDiscountInput`, `getProductQuantity`, `finalizeSale`, `handleQuickSale`, and the `effectiveCart` / `effectiveTotals` / `effectiveTotalItems` / `effectiveDiscountInput` / `effectiveAllowCreditSales` computations.
- `finalizeTableOrderWithPayments` is a 90-line function that duplicates receipt-snapshot logic from `usePosCheckout`.

If we add a third sale mode (delivery, hotel, kiosko) by extending the same pattern, the context will gain another set of `if (deliveryMode)` branches, another unconditional hook call, and another 90-line finalize function. The provider is already 927 lines; this does not scale.

## Decision

Introduce a **SaleModeAdapter** interface that abstracts the cart, actions, and checkout strategy for a sale mode. The POS context holds a single `activeMode` adapter and delegates to it instead of branching.

```typescript
interface SaleModeAdapter {
  readonly modeId: string;
  readonly isActive: boolean;

  // Cart state
  cart: CartItem[];
  totals: CartTotals;
  totalItems: number;
  discountInput: string;
  allowCreditSales: boolean;

  // Cart actions
  addToCart(product: Product, modifiers: CartItemModifier[]): void;
  updateQuantity(cartItemId: string, delta: number): void;
  removeFromCart(cartItemId: string): void;
  clearCart(): void;
  updateItemDiscount(cartItemId: string, value: string): void;
  setDiscountInput(value: string): void;
  getProductQuantity(productId: string): number;

  // Checkout
  finalizeSale(payments: SalePayment[], options: SaleFinalizeOptions): Promise<SaleResult>;
  quickSale(options: SaleFinalizeOptions): Promise<SaleResult>;
  isProcessing: boolean;
  closeOrderError: Error | null;

  // Mode lifecycle
  enter(): void;
  exit(): void;
}
```

### Concrete adapters

- **CounterSaleAdapter** — wraps `usePosCart` + `usePosCheckout`. This is the default mode; no module dependency.
- **TableSaleAdapter** — wraps `usePosTableOrder` + table checkout logic. Provided by the restaurants module. Only instantiated when the module is accessible.

### Mode registry

Adapters are registered per module, not hardcoded in the context:

```typescript
// features/restaurants/restaurants.module.ts
export const restaurantModuleDefinition = defineModule({
  // ...existing fields...
  getPosSaleModes: ({ accessible }) =>
    accessible ? [tableSaleModeFactory] : [],
});
```

The POS context collects sale-mode factories from all enabled modules, plus the built-in counter mode. The active mode is determined by user action (e.g., selecting a table triggers `enterTableMode`, which activates the table adapter).

### Migration path

1. Extract `usePosTableOrder` + table finalize logic into `TableSaleAdapter`.
2. Extract `usePosCart` + counter checkout into `CounterSaleAdapter`.
3. Replace all `if (tableOrder.activeTableId)` branches in `pos-page-context.tsx` with `activeMode.method()`.
4. The `PosTableSessionState` exposed to UI becomes `activeMode.sessionState` (a generic `Record<string, unknown>` or a typed union).

## Consequences

- **No branching in the context.** Adding a delivery mode means creating `DeliverySaleAdapter` and registering it — zero changes to `pos-page-context.tsx`.
- **Modules own their sale logic.** The restaurants module owns `TableSaleAdapter`; a future hotel module owns `HotelSaleAdapter`.
- **The adapter interface is the contract.** It grows only when a second mode needs the same new capability (per ADR-0004's "two adapters make the seam real" rule).
- **Counter mode has no module dependency.** The POS works without any module enabled.
- **Receipt printing stays shared.** The adapter returns a `SaleResult` + `receiptSnapshot`; the context handles printing uniformly.

## Implementation Notes

- Start by extracting `TableSaleAdapter` as the second adapter (counter is the first, already implicit).
- Keep `usePosCheckout` as the shared payment computation engine; adapters call it with their own cart/totals.
- The `SaleFinalizeOptions` type carries `shiftId`, `customerId`, `closeModal`, and `printReceipt` — shared concerns that adapters don't reimplement.
- `enter()` / `exit()` handle mode-specific cleanup (e.g., table adapter resets payments and discount).

## Related Files

- `features/pos/pos-page-context.tsx` (god provider to decompose)
- `features/pos/hooks/use-pos-cart.ts` (counter cart — becomes CounterSaleAdapter)
- `features/pos/hooks/use-pos-checkout.ts` (shared checkout engine)
- `features/pos/hooks/use-pos-table-order.ts` (table cart — becomes TableSaleAdapter)
- `features/restaurants/restaurants.module.ts` (module definition to extend)
- `features/modules/module-definition.ts` (interface to extend with `getPosSaleModes`)
- ADR-0004 (module interface beyond navigation)
