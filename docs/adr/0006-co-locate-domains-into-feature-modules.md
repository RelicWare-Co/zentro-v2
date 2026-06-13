# ADR 0006: Co-locate each domain into its feature module

## Status

Accepted

## Date

2026-06-13

## Context

The repository runs four competing top-level organizing principles at once:

- **by domain** — `features/`
- **by file-type** — `schemas/`, `hooks/`, `types/`, `lib/`, `components/`
- **by runtime** — `server/`, whose subfolders (`server/sales`, `server/credit`, `server/dashboard`, `server/admin`, `server/organization`, `server/restaurants`, `server/modules`, `server/settings`) duplicate feature names
- **isolated core** — `src/zero/`, the only inhabitant of `src/`

The consequence is that a single domain concept is shattered across trees. A **Sale** lives in `features/sales/` (UI, hooks, `.shared`), `schemas/sales.ts` (Zod contract), `server/sales/{create-sale,cancel-sale}.server.ts` (authoritative writes), and the `src/zero` registries. To change "how a sale is created" a maintainer must touch four directories. No module owns the concept, so there is no locality: knowledge, bugs, and verification are spread instead of concentrated.

The split by file-type and the split by runtime are both avoidable. The runtime seam does not require a separate `server/` tree — Vike already enforces the `.server.ts` / `.client.ts` file-environment suffix in *any* directory (see AGENTS.md → Vike). Today `features/` contains zero `.server.ts` files only because server logic was pulled out into `server/`, not because the boundary requires it.

## Decision

**Co-locate each domain in its `features/<domain>` module.** A feature owns the whole concept: contract, reads, writes, server-authoritative logic, and UI.

- Move `schemas/<domain>.ts` → `features/<domain>/<domain>.schema.ts`.
- Move `server/<domain>/*.server.ts` (domain logic) → `features/<domain>/*.server.ts`.
- Reduce top-level `server/` to the **app shell only**: transport and wiring, not domain logic.

The dividing line is explicit:

> **Domain logic → feature. Transport / wiring → `server/`.**

What stays in `server/`:

- `server/hono.ts` — the Hono app and route registration
- `server/db-middleware.ts`
- `server/runtime-config.server.ts`
- `server/zero/` — `handler.server.ts` (`/api/zero/*`) and `context.server.ts` (`resolveZeroAuth`)
- `server/qz/` — the QZ signing endpoint
- `server/dashboard/handler.server.ts` stays only as the REST transport for `GET /api/dashboard/overview`; its SQL aggregation logic moves to `features/dashboard/*.server.ts` and the handler calls into it.

### File naming convention

Files in a feature follow `<domain>.<role>.ts`, with Vike environment suffixes carrying the runtime seam:

```
features/sales/
  sales.schema.ts            # Zod contract — isomorphic, browser-safe
  sales.queries.ts           # read interface  (see ADR-0007)
  sales.mutators.ts          # write interface, optimistic (see ADR-0007)
  sales.mutators.server.ts   # server-authoritative override + side effects
  sales-page.tsx · hooks/ · *.shared.ts
```

### Cross-feature schemas

A schema lives with its **owning** domain. Three schemas are consumed by more than one feature:

- `customers` (customers + pos) → `features/customers/customers.schema.ts`
- `pos` (pos + shifts) → `features/pos/pos.schema.ts`
- `modules` (no feature consumer; only the Zero registry + `server/`) → `features/modules/modules.schema.ts`

Non-owning consumers import the schema across features. Cross-feature imports of `*.schema.ts` are allowed because the files are isomorphic and browser-safe. Only promote a schema to the shared `zero/` core if it has no single owning domain.

## Consequences

- **Locality.** One concept, one folder. A change to "how a sale is created" is confined to `features/sales`.
- **The schema is the test surface.** The Zod contract sits next to the mutator it validates and the UI that submits it.
- **Two top-level trees disappear** (`schemas/`, and the domain subfolders of `server/`); `server/` shrinks to a recognizable app shell.
- **The runtime seam is unchanged** — it moves from a directory convention to the file-suffix convention the project already documents and enforces.
- **Migration is big-bang** (see ADR-0007 for the rationale and the shared cutover). The file moves here are pure relocations: ~40 `schemas/` import sites and ~10 `server/<domain>` import sites are rewritten by codemod, and `bunx tsc --noEmit` is a total check over the result.
- **`server/dashboard` is the one nuance** — it keeps a thin transport handler while its aggregation logic moves into the feature, so the dashboard's REST seam survives the move.

## Implementation Notes

- Do the relocation and import rewrite as one mechanical, codemod-driven change; let `tsc` verify completeness before review.
- Keep `lib/` and `components/ui` for genuinely cross-cutting code only. Single-consumer files in `hooks/`, `types/`, and `lib/` should follow the same co-location rule (tracked separately; see review candidate D — not part of this ADR).
- Update AGENTS.md: the Zero "File layout" section and any reference to `schemas/` and `server/<domain>` must reflect the feature-local layout in the same change.

## Related Files

- `features/*/` (target home for each domain)
- `schemas/*.ts` (dissolved)
- `server/sales/`, `server/credit/`, `server/dashboard/`, `server/admin/`, `server/organization/`, `server/restaurants/`, `server/modules/`, `server/settings/` (domain logic dissolved into features)
- `server/hono.ts`, `server/db-middleware.ts`, `server/runtime-config.server.ts`, `server/zero/`, `server/qz/` (the retained app shell)
- AGENTS.md (Zero file layout, Vike conventions)
