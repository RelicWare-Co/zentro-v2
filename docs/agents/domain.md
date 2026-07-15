# Domain Docs

How engineering skills should consume this repo's domain documentation.

## Current State

This is a single-context repo, but it currently does **not** have a root
`CONTEXT.md` or `CONTEXT-MAP.md`. Do not block on their absence.

Use these sources instead:

- `AGENTS.md` — current project conventions, commands, boundaries, and workflows.
- `MIGRATION_PLAN.md` — historical oRPC to Zero migration context and Zero-first direction.
- `docs/adr/` — accepted architectural decisions.
- `plans/` — implementation plans and follow-up work that may explain recent intent.
- `docs/fix-log/` — non-trivial bug fixes and diagnostic history.

## Before Exploring

1. Read `AGENTS.md`.
2. Read ADRs that touch the area you are about to change.
3. Read `MIGRATION_PLAN.md` before porting behavior from `../zentro-reborn` or touching old API assumptions.
4. Read relevant `plans/` and `docs/fix-log/` entries when investigating active work, regressions, or design intent.

Proceed silently if an optional file is absent. Only suggest creating
`CONTEXT.md` when the task is specifically about documenting domain vocabulary
or when unclear language is causing real implementation risk.

## Domain Vocabulary

Use the vocabulary already present in feature folders, schemas, ADRs, and UI
copy. Important current domains include:

- `organization`
- `modules`
- `dashboard`
- `products` / inventory / Kardex
- `customers`
- `sales`
- `pos`
- `shifts`
- `restaurants`
- `credit`
- `settings`
- `admin`

If a new concept does not fit existing language, call that out in the issue,
plan, or PR notes instead of inventing a parallel term.

## ADR Conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding the decision:

> Contradicts ADR-0007 (split Zero registries into feature slices), but worth
> reopening because...
