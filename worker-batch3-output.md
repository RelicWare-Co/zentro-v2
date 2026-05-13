# Batch 3 — Ultracite Lint Fixes

## Files Fixed

1. `features/restaurants/components/restaurant-module-settings-card.tsx`
2. `features/organization/organization-management.tsx`

## Errors Found & Resolved

### `features/restaurants/components/restaurant-module-settings-card.tsx`
- **Rule:** `lint/style/noNestedTernary`
- **Location:** `restaurantConfigMutationError` variable declaration (lines 53, 55, 57, 59)
- **Problem:** Deeply nested ternary chain checking five different mutation error objects to extract the first error message.
- **Fix:** Replaced the nested ternary with an immediately-invoked arrow function containing explicit `if` statements and early returns. This preserves the exact same logic (return the first `Error.message` found, or `null`).

### `features/organization/organization-management.tsx`
- **Rule:** `lint/style/noNestedTernary`
- **Location:** `JoinLinkStatusBadge` component (lines 1424, 1426)
- **Problem:** Nested ternary selecting a Tailwind class string based on `OrganizationJoinLinkStatus`.
- **Fix:** Replaced the ternary with a `let` declaration and an `if / else if / else` block that assigns the correct class string for each status. The `Badge` JSX and `formatJoinLinkStatusLabel` call remain unchanged.

## Verification

```bash
bunx biome check --max-diagnostics=50 \
  features/restaurants/components/restaurant-module-settings-card.tsx \
  features/organization/organization-management.tsx
```

**Result:** `Checked 2 files in 22ms. No fixes applied.` — **Zero errors remain.**

## Behavior Impact

No functional changes. Only syntactic refactoring from nested ternaries to explicit `if` blocks to satisfy the `noNestedTernary` rule.
