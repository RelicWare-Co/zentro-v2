# Batch 13 Ultracite Fixes

## Files Fixed
- `pages/login/+Page.tsx`
- `pages/pos/+Page.tsx`
- `pages/posv2/+Page.tsx`

## Fixes Applied

### `pages/login/+Page.tsx`
1. **`lint/style/noNestedTernary` (2 occurrences)**
   - **LoginForm** (line ~313): Replaced nested ternary button label with explicit `if/else` block assigning to a `submitLabel` variable before the JSX return.
   - **RegisterForm** (line ~510): Same pattern — replaced nested ternary with an explicit `if/else` block and `submitLabel` variable.

2. **`lint/complexity/noVoid` (2 occurrences)**
   - **CardForSignedInUser** (lines ~542, ~551): Replaced `() => void props.onJoin()` and `() => void props.onSwitchAccount()` with block-bodied arrow functions `() => { props.onJoin(); }` and `() => { props.onSwitchAccount(); }`. This avoids the `void` operator while keeping the promise uncaught (same behavior as before).

### `pages/pos/+Page.tsx`
1. **`lint/suspicious/useAwait` (line ~210)**
   - Removed `async` keyword from `handleBarcodeScan`. Changed return type from `Promise<boolean>` to `boolean` since the function contained no `await` expressions.

2. **`lint/correctness/noUnusedVariables` (line ~104)**
   - Renamed destructured `setIsModifierModalOpen` to `_setIsModifierModalOpen` to suppress the unused-variable error while keeping the positional destructuring intact.

### `pages/posv2/+Page.tsx`
1. **`lint/suspicious/useAwait` (line ~200)**
   - Removed `async` keyword from `_handleBarcodeScan`. Changed return type from `Promise<boolean>` to `boolean` since the function contained no `await` expressions.

2. **`lint/correctness/noUnusedVariables` (line ~94)**
   - Renamed destructured `setIsModifierModalOpen` to `_setIsModifierModalOpen` to suppress the unused-variable error while keeping the positional destructuring intact.

## Verification
```bash
bunx biome check --max-diagnostics=50 pages/login/+Page.tsx pages/pos/+Page.tsx pages/posv2/+Page.tsx
```
**Result:** `Checked 3 files in 14ms. No fixes applied.` — zero errors remain.
