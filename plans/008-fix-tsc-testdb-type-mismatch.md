# Plan 008: Fix `bunx tsc --noEmit` — TestDb vs DrizzleDatabase type mismatch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- tests/helpers/ zero/db-provider.server.ts zero/sdk.server.ts database/drizzle/db.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

`bunx tsc --noEmit` fails with 22 errors, all the same root cause: `TestDb`
(`PostgresJsDatabase<typeof schema> & { $client: Sql }`) is not assignable to
the `DrizzleDatabase<PgQueryResultHKT, Record<string, unknown>>` that
`zeroDrizzle()` expects. CI (`.github/workflows/ci.yml:31`) runs this exact
command, so **the typecheck gate is red**. Without a green typecheck, no
refactor can be trusted, and every other plan in this batch depends on a
trustworthy `tsc` signal.

## Current state

- `tests/helpers/test-db.ts:10` — `export type TestDb = PostgresJsDatabase<typeof schema> & { $client: Sql };`
- `tests/helpers/zero-shifts.ts:62-64` — `createZeroTestDb(db: TestDb)` calls
  `zeroDrizzle(zeroSchema, db)`. The second argument type-mismatches.
- `zero/db-provider.server.ts:18` — production code calls
  `zeroDrizzle(schema, db)` where `db` is `Database = ReturnType<typeof createDb>`
  (a `PostgresJsDatabase<typeof schema>` behind a Proxy). This compiles fine
  because the Proxy's static type is `Database` and TypeScript's structural
  check passes for the production path; the `& { $client: Sql }` intersection
  on `TestDb` widens the structural type enough to break compatibility with
  `zeroDrizzle`'s expected `DrizzleDatabase<PgQueryResultHKT, Record<string,
  unknown>>`.
- 22 error sites across: `tests/helpers/zero-shifts.ts:63`,
  `tests/ingredients.test.ts` (6 sites), `tests/pos.test.ts:432`,
  `tests/products.test.ts` (5 sites), and more — all identical
  `TS2345: Argument of type 'TestDb' is not assignable to parameter of type
  'DrizzleDatabase<PgQueryResultHKT, Record<string, unknown>>'`.
- `bun run check` (Ultracite/Biome) passes cleanly — this is a TypeScript-only
  issue, not a lint issue.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run check` | "No fixes applied", exit 0 |
| Tests | `docker compose up -d postgres && bun test tests/*.test.ts` | all pass |

## Scope

**In scope** (the only files you should modify/create):
- `tests/helpers/zero-shifts.ts` (the `createZeroTestDb` function — cast the
  `db` argument to satisfy `zeroDrizzle`'s expected type)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `tests/helpers/test-db.ts` — do not change the `TestDb` type definition; the
  `$client` property is used by test cleanup code.
- `zero/db-provider.server.ts` — production code compiles fine; do not change it.
- `zero/sdk.server.ts` — the `as any` at line 70 is a separate finding (plan
  015); do not address it here.
- `database/drizzle/db.ts` — do not change the production `Database` type.
- Any `tests/*.test.ts` file — the errors all flow through `createZeroTestDb`;
  fixing the helper fixes all 22 sites.

## Git workflow

- Branch: `advisor/008-fix-tsc-testdb-type-mismatch`
- Conventional commit, e.g. `fix(tests): cast TestDb to zeroDrizzle expected type`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the baseline failure

Run `bunx tsc --noEmit` and confirm you see ~22 `TS2345` errors, all
originating from `zeroDrizzle(zeroSchema, db)` calls where `db` is `TestDb`.

**Verify**: `bunx tsc --noEmit 2>&1 | grep -c "error TS2345"` → `22` (or
similar count). If the count is 0, the issue may already be fixed — STOP.

### Step 2: Fix the type cast in `createZeroTestDb`

In `tests/helpers/zero-shifts.ts`, change `createZeroTestDb` to cast `db` to
the type `zeroDrizzle` expects. The cleanest approach is to extract the
expected type from the `zeroDrizzle` signature:

```ts
export function createZeroTestDb(db: TestDb) {
  return zeroDrizzle(
    zeroSchema,
    db as Parameters<typeof zeroDrizzle>[1]
  );
}
```

This cast is safe because `TestDb` is a fully-typed Drizzle Postgres client
with the complete schema — it is structurally identical to what production
passes; the only issue is the `& { $client: Sql }` intersection confusing
TypeScript's variance check on `PgSession`.

**Verify**: `bunx tsc --noEmit` → exit 0, no output.

### Step 3: Run lint and tests

**Verify**:
- `bun run check` → exit 0 (no new lint issues from the cast; Biome does not
  flag `as` casts in test helpers).
- `docker compose up -d postgres && bun test tests/*.test.ts` → all pass
  (the cast is type-level only; runtime behavior is unchanged).

## Test plan

No new tests. The deliverable is the green typecheck gate itself.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0 with no output
- [ ] `bun run check` exits 0
- [ ] `bun test tests/*.test.ts` all pass (Postgres up)
- [ ] `git status` shows no modified files outside `tests/helpers/zero-shifts.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `bunx tsc --noEmit` produces errors OTHER than the `TS2345 TestDb` mismatch
  — those are separate issues; report them but do not fix them in this plan.
- The `as Parameters<typeof zeroDrizzle>[1]` cast triggers a Biome lint error
  that cannot be resolved with a scoped `biome-ignore` comment — report the
  exact rule and error.
- `zeroDrizzle`'s signature has changed and `Parameters<typeof zeroDrizzle>[1]`
  does not resolve — report the actual signature.

## Maintenance notes

- The root cause is a variance incompatibility between Drizzle's
  `PostgresJsDatabase<typeof schema>` (with `PostgresJsQueryResultHKT`) and
  `zeroDrizzle`'s expected `DrizzleDatabase<PgQueryResultHKT, Record<string,
  unknown>>`. If `@rocicorp/zero` ever ships a fix that accepts typed Drizzle
  clients, this cast can be removed.
- If `TestDb` is ever refactored to drop the `& { $client: Sql }` intersection,
  re-test whether the cast is still needed.
