# Batch 7 Fix Report

## File: `components/ui/input-otp.tsx`

### Errors Found
1. `lint/a11y/useFocusableInteractive` at line 74: `<div>` with `role="separator"` is not focusable.
2. `lint/a11y/useSemanticElements` at line 77: `role="separator"` on `<div>` should be `<hr>`.
3. `lint/a11y/useAriaPropsForRole` at line 77: `role="separator"` requires `aria-valuenow`.

### Fix Applied
Removed the `role="separator"` attribute from the `<div>` in the `InputOTPSeparator` component.

```diff
     <div
       className="flex items-center [&_svg:not([class*='size-'])]:size-4"
       data-slot="input-otp-separator"
-      role="separator"
       {...props}
     >
```

### Rationale
The `InputOTPSeparator` component renders a visual divider (minus icon) between OTP input groups. The explicit `role="separator"` triggered three accessibility lint violations:
- A `<div>` with `role="separator"` must be focusable (`useFocusableInteractive`)
- A `<div>` with `role="separator"` should use the semantic `<hr>` element instead (`useSemanticElements`)
- A `role="separator"` requires an `aria-valuenow` prop (`useAriaPropsForRole`)

Changing to `<hr>` was not viable because `<hr>` is a void element and cannot contain the `<MinusIcon />` child. Removing the explicit role resolves all three violations while preserving the identical visual behavior. The separator is primarily decorative in this context, and the OTP input groups remain independently accessible to screen readers.

### Verification
- **Biome check**: `bunx biome check --max-diagnostics=50 components/ui/input-otp.tsx` → exit code 0, no issues.
- **TypeScript**: No diagnostics found via LSP.
