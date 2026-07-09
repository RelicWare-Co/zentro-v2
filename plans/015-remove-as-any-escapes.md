# Plan 015: Remove `as any` type escapes in production code and tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- zero/sdk.server.ts tests/sales.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 008 (typecheck gate must be green to verify changes)
- **Category**: debt
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

`as any` type escapes silence the TypeScript compiler and eliminate type
safety at critical boundaries. In production code (`zero/sdk.server.ts`), an
`as any` on the schema argument to `defineZentroMutator` means schema changes
won't be caught at the mutator definition site. In tests (`tests/sales.test.ts`),
`as any` on settings metadata means test data can drift from the real schema
without any type error. Each escape is a small risk, but together they
undermine the value of the typecheck gate that plan 008 restores.

## Current state

### Production code

- `zero/sdk.server.ts:69-70`:
  ```ts
  // biome-ignore lint/suspicious/noExplicitAny: args type is enforced by the generic TSchema
  return defineZentroMutator(schema as any, async ({ tx, args, ctx }) => {
  ```
  The `schema as any` is needed because `defineZentroMutator`'s generic
  constraint on the schema parameter may not perfectly align with the
  `z.ZodType` that `defineZentroServerMutator` accepts. The `biome-ignore`
  comment acknowledges the escape.

### Test code

- `tests/sales.test.ts:1005, 1159, 1221` — three identical sites:
  ```ts
  metadata: serializeOrganizationSettingsMetadata(settings as any),
  ```
  The `settings as any` is needed because the test constructs a partial
  settings object that doesn't match the full `OrganizationSettings` type
  expected by `serializeOrganizationSettingsMetadata`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/sales.test.ts` | all pass |

## Scope

**In scope**:
- `zero/sdk.server.ts` (the `schema as any` at line 70)
- `tests/sales.test.ts` (the `settings as any` at lines 1005, 1159, 1221)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `zero/sdk.ts` — the `defineZentroMutator` definition; if its generic
  constraint is the root cause, fixing it there is a separate change that
  affects all mutators. Only fix the call site in `sdk.server.ts`.
- Any other `as any` in the codebase — scope is limited to the two documented
  sites.

## Git workflow

- Branch: `advisor/015-remove-as-any-escapes`
- Conventional commit, e.g. `refactor: replace as any with precise type casts`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Fix `zero/sdk.server.ts` — replace `schema as any` with a precise cast

The `defineZentroMutator` function from `@/zero/sdk` accepts a `z.ZodType` (or
similar). The `schema` parameter in `defineZentroServerMutator` is already
constrained as `TSchema extends z.ZodType`. The `as any` is likely needed
because `defineZentroMutator`'s parameter type is narrower or wider than
`z.ZodType`.

Investigate the actual type signature:
```bash
grep -n "export function defineZentroMutator" zero/sdk.ts
```

Then replace `schema as any` with a cast to the exact type
`defineZentroMutator` expects, e.g.:
```ts
return defineZentroMutator(
  schema as Parameters<typeof defineZentroMutator>[0],
  async ({ tx, args, ctx }) => {
```

If `Parameters<typeof defineZentroMutator>[0]` resolves to `z.ZodType` and
`schema` is already `TSchema extends z.ZodType`, the cast may be unnecessary —
try removing it entirely first. If `tsc` passes without the cast, remove it
and the `biome-ignore` comment.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run check` → exit 0 (no
`noExplicitAny` lint error).

### Step 2: Fix `tests/sales.test.ts` — replace `settings as any` with a precise cast

Find the type that `serializeOrganizationSettingsMetadata` expects:
```bash
grep -n "export function serializeOrganizationSettingsMetadata" features/settings/settings.shared.ts
```

Then replace `settings as any` with a cast to `Partial<ExpectedType>` or
construct the settings object with the correct type. If the test only needs a
subset of fields, use `Partial<OrganizationSettings>` (or whatever the
function's parameter type is):

```ts
metadata: serializeOrganizationSettingsMetadata(
  settings as Partial<Parameters<typeof serializeOrganizationSettingsMetadata>[0]>
),
```

Or better: type the `settings` variable correctly at its construction site so
no cast is needed at all.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run check` → exit 0.

### Step 3: Run the sales test suite

**Verify**: `docker compose up -d postgres && bun test tests/sales.test.ts` → all pass.

## Test plan

No new tests — the change is type-level only; runtime behavior is unchanged.

## Done criteria

- [ ] `grep -c "as any" zero/sdk.server.ts` = 0
- [ ] `grep -c "as any" tests/sales.test.ts` = 0 (or reduced from 3 to 0)
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run check` exits 0
- [ ] `bun test tests/sales.test.ts` all pass
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Removing `schema as any` from `zero/sdk.server.ts` causes a type error that
  requires changing `defineZentroMutator`'s signature in `zero/sdk.ts` — that
  is a larger change; report the exact type incompatibility and do not change
  `zero/sdk.ts` in this plan.
- The `settings` variable in `tests/sales.test.ts` is constructed inline (not
  as a named variable) and typing it correctly requires refactoring the test
  setup — report the construction site and suggest a follow-up.
- `serializeOrganizationSettingsMetadata` accepts `unknown` and the `as any`
  is masking a different issue — report what you find.

## Maintenance notes

- The `as any` in `zero/sdk.server.ts` exists because of a generic variance
  issue between `defineZentroServerMutator`'s `TSchema extends z.ZodType` and
  `defineZentroMutator`'s expected schema type. If `@rocicorp/zero` or the
  local `defineZentroMutator` wrapper is ever updated to accept `z.ZodType`
  directly, the cast can be removed entirely.
- The `as any` in `tests/sales.test.ts` exists because test fixtures construct
  partial settings objects. A shared test fixture factory
  (`tests/helpers/settings-fixture.ts`) that produces correctly-typed settings
  would eliminate this class of escape across all test files.
