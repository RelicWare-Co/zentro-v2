# Batch 10 Fix Report — features/products/products-page.tsx

## Errors Fixed

### 1. `lint/style/noNestedTernary` (3 occurrences)

#### Line 230 — `resolvedCategoryId` nested ternary
**Before:**
```tsx
const resolvedCategoryId =
  categoryFilter === ALL_FILTER_VALUE
    ? null
    : categoryFilter === UNCATEGORIZED_FILTER_VALUE
      ? "uncategorized"
      : categoryFilter;
```
**After:**
```tsx
let resolvedCategoryId: string | null;
if (categoryFilter === ALL_FILTER_VALUE) {
  resolvedCategoryId = null;
} else if (categoryFilter === UNCATEGORIZED_FILTER_VALUE) {
  resolvedCategoryId = "uncategorized";
} else {
  resolvedCategoryId = categoryFilter;
}
```

#### Line 742 — `StockBadge` `className` nested ternary
**Before:**
```tsx
const className =
  product.stock <= 0
    ? "border-red-500/20 bg-red-500/10 text-red-300"
    : product.stock < 10
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
```
**After:**
```tsx
let className: string;
if (product.stock <= 0) {
  className = "border-red-500/20 bg-red-500/10 text-red-300";
} else if (product.stock < 10) {
  className = "border-amber-500/20 bg-amber-500/10 text-amber-300";
} else {
  className = "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
}
```

#### Line 752 — `StockBadge` badge label nested ternary
**Before:**
```tsx
{product.stock <= 0
  ? "Sin stock"
  : product.stock < 10
    ? "Stock bajo"
    : "En stock"}
```
**After:**
```tsx
let stockLabel: string;
if (product.stock <= 0) {
  stockLabel = "Sin stock";
} else if (product.stock < 10) {
  stockLabel = "Stock bajo";
} else {
  stockLabel = "En stock";
}
// JSX: {stockLabel}
```

### 2. `lint/correctness/useExhaustiveDependencies` (line 345)
**Cause:** `openEditProduct` was an inline function defined inside the component, so it changed on every render and should not be used as a hook dependency.
**Fix:** Wrapped `openEditProduct` in `useCallback` with an empty dependency array (safe because it only calls stable `setEditingProduct` / `setIsSheetOpen` state setters). Also added `useCallback` to the React imports.

```tsx
const openEditProduct = useCallback((product: Product) => {
  setEditingProduct(product);
  setIsSheetOpen(true);
}, []);
```

### 3. Formatting error
The import line grew too long after adding `useCallback`. Reformatted the React import to multi-line to satisfy the formatter.

### 4. Unused declarations (bonus cleanup)
Removed two dead-code declarations that were never referenced:
- `_dateFormatter`
- `_normalizeSearchTerm`

## Verification

```bash
bunx biome check --max-diagnostics=50 features/products/products-page.tsx
# Result: Checked 1 file in 20ms. No fixes applied.

bunx biome lint features/products/products-page.tsx
# Result: Checked 1 file in 17ms. No fixes applied.
```

Zero biome lint/format errors remain in the file.
