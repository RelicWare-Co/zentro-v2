# React Doctor: compiler syntax + only-export-components

## Symptom

`npx react-doctor@latest --verbose` reported 16 **ERROR**-level “React Compiler doesn't support this syntax” findings (`react-hooks-js/todo`) and 20 **WARN**-level `only-export-components` findings.

## Root cause

1. **Compiler syntax:** React Compiler cannot lower `try/finally`, some `throw` patterns inside `try/catch`, `String.raw` tagged templates in render, and dynamic `import()` inside component bodies. Affected components were skipped for automatic memoization.
2. **Fast Refresh exports:** Component `.tsx` files also exported non-components (`buttonVariants`, `*PageCompound` objects, payment helpers, `Slot` object shim), breaking Vite Fast Refresh boundaries.

## Solution

- Replaced `try/finally` with `try/catch` + explicit cleanup after the block; removed `throw` used only for local control flow in printer settings.
- Moved `String.raw` calendar classes to module-level string constants.
- Replaced dynamic imports with static imports (`zero-provider-gate.client.tsx`, `organization-transition-context`, local printer settings).
- Split UI `cva` variants, payment-grid helpers, print lifecycle, and desktop Radix shim into sibling non-component modules; removed unused `*PageCompound` exports from page files.

## Verification

```bash
npx react-doctor@latest --verbose
python3 -c "import json; d=json.load(open('<tmpdir>/diagnostics.json')); print([x for x in d if 'BuildHIR' in x.get('help','') or x.get('rule')=='only-export-components'])"
# → []
bunx tsc --noEmit
```
