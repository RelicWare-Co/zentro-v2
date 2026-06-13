# ADR 0007: Split the Zero registries into per-feature slices

## Status

Accepted

## Date

2026-06-13

## Context

The Zero data interface for all 16 features funnels through three flat god-files:

- `src/zero/queries.ts` — 817 lines, 28 query groups
- `src/zero/mutators.ts` — 1216 lines, 42 mutators
- `src/zero/mutators.server.ts` — 624 lines, server-authoritative overrides

There is no per-domain seam. To touch sales writes a maintainer loads 1216 lines covering every unrelated domain; merge conflicts concentrate in the same three files; and the read/write interface for a concept lives nowhere near the feature that owns it. This is the same scattering as ADR-0006, expressed in the data layer.

Separately, `src/zero/` is the only thing under `src/` — every other top-level directory (`features/`, `server/`, `database/`, `pages/`) sits at the repo root. The lone `src/` is an organizing-principle inconsistency a new reader stumbles on immediately.

## Decision

**Split the registries into per-feature slices, and relocate the Zero core to a top-level `zero/`.**

### 1. Slices live in the feature (pairs with ADR-0006)

Each feature exports its own query and mutator definitions:

```
features/sales/
  sales.queries.ts          # defineQuery(...) entries — imports zero/schema only
  sales.mutators.ts         # defineMutator(...) entries — optimistic
  sales.mutators.server.ts  # server-authoritative overrides
```

### 2. `src/zero/` → top-level `zero/`

Eliminate `src/`. The isomorphic core moves to `zero/` alongside `features/`, `server/`, and `database/`, giving the repo a single top-level principle. The `@/*` alias maps to the repo root, so `@/src/zero/*` imports become `@/zero/*` — ~39 mechanical import rewrites.

### 3. The registry shrinks to a composition root

`zero/queries.ts` and `zero/mutators.ts` stop holding definitions and become thin composition: they import the feature slices and spread them into the single registry object Zero requires.

```ts
// zero/queries.ts  (~40 lines)
import { defineQueries } from "@rocicorp/zero";
import { salesQueries } from "@/features/sales/sales.queries";
import { productsQueries } from "@/features/products/products.queries";
// ...
export const queries = defineQueries({ ...salesQueries, ...productsQueries /* ... */ });
```

Zero still dispatches by name through one `defineQueries` / `defineMutators` object; `mustGetQuery(queries, name)` is unaffected. We split the **definitions**, not the registry.

### 4. Dependency direction — no cycles

A single, enforced invariant:

> Slices import **only** `zero/schema` (`zql`, `defineQuery`, `defineMutator`, row types). The composition root imports the slices. React hooks import the registry.

```
features/sales/sales.queries.ts  →  zero/schema           (no back-edge)
zero/queries.ts (registry)       →  features/*/​*.queries  (one-way)
features/sales/hooks/use-sales   →  zero/queries (registry)
```

This makes `zero/` a **composition root that imports features** — the core is no longer feature-agnostic. That is the accepted trade-off: the registry is the one place allowed to know every feature, exactly as a DI root knows its leaves. The no-back-edge rule (slices never import the registry) keeps the module graph acyclic.

## Consequences

- **Locality.** Sales reads and writes live with sales; the registry becomes pure composition.
- **Merge conflicts stop concentrating** in three shared files.
- **Big-bang cutover.** This ADR and ADR-0006 are the same structural move at two scales and ship together: file moves (codemod, `tsc`-verified) plus the registry split.
- **The split is the risky part of big-bang, and it has no type guarantee.** Composing `defineQueries({ ...16 slices })` while preserving all 28 query names and 42 mutator names is hand-work; a dropped name compiles cleanly and fails at runtime, because dispatch is by string. **Mitigation (required):** add a test that asserts the registry's key set (query names + mutator names) is unchanged before and after the split — capture the current key list first and assert against it.
- **`zero/` knows about every feature.** Accepted; bounded to the two composition-root files and guarded by the no-back-edge invariant.
- **`src/` is removed**, leaving one top-level organizing principle.

## Implementation Notes

1. **Before splitting**, snapshot the current registry key sets (`Object.keys` over the flattened `queries` and `mutators`) into a test fixture. This is the regression guard for the entire cutover.
2. Move `src/zero` → `zero` and codemod `@/src/zero` → `@/zero` (~39 sites) as the first step; verify with `tsc`.
3. Extract per-domain definitions into `features/<domain>/<domain>.{queries,mutators,mutators.server}.ts`, importing only from `@/zero/schema`.
4. Reduce `zero/queries.ts`, `zero/mutators.ts`, `zero/mutators.server.ts` to composition that spreads the slices.
5. Run `bunx tsc --noEmit`, the registry-key test, `bun run check`, and `bun test` before review.
6. Update AGENTS.md and `MIGRATION_PLAN.md`: the `src/zero/*` file-layout references become `zero/*`, and the queries/mutators sections must describe feature-local slices composed at the root.

## Related Files

- `src/zero/queries.ts`, `src/zero/mutators.ts`, `src/zero/mutators.server.ts` (split + relocated)
- `src/zero/schema.ts`, `src/zero/context.ts`, `src/zero/client.ts`, `src/zero/*.client.tsx` (relocated to `zero/`)
- `server/zero/handler.server.ts` (consumes the composed registries; import path updated)
- `features/*/​*.queries.ts`, `features/*/​*.mutators.ts`, `features/*/​*.mutators.server.ts` (new slice homes)
- `tsconfig.json` (`@/*` alias — unchanged; only import specifiers move)
- AGENTS.md, `MIGRATION_PLAN.md`
