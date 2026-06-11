# Plan 001: Make `bun test` a usable gate and add a CI pipeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d97b06e..HEAD -- package.json .github/workflows AGENTS.md tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `d97b06e`, 2026-06-10

## Why this matters

This repo currently has **no automated verification**. The only GitHub
workflow is a manual desktop MSIX build. Worse, the advertised test command is
broken as a gate: `bun test` sweeps up the Playwright `.spec.ts` files under
`tests/e2e/` (which can only run under the Playwright runner — 118 of them
"fail" instantly) and mixes them with the real integration tests in
`tests/*.test.ts`. A developer or agent running `bun test` gets a wall of
noise and cannot tell a real regression from runner pollution. Every other
plan in `plans/` relies on a trustworthy typecheck + lint + test gate; this
plan creates it.

## Current state

- `package.json:79` (scripts) — `"test": "bun test"`. Bun's runner discovers
  both `*.test.ts` and `*.spec.ts`, so it picks up `tests/e2e/**/*.spec.ts`.
  Confirmed behavior at the planned-at commit: `bun test` → "19 pass, 118
  fail, 6 errors … Ran 137 tests across 24 files", with Playwright printing
  "You are calling test.describe() in a configuration file" errors.
- `bun test tests/*.test.ts` correctly runs only the 18 integration files
  ("Ran 131 tests across 18 files"). **Verified baseline at the planned-at
  commit: with local Postgres up, all 131 pass, 0 fail (~30s).** These tests
  REQUIRE a running Postgres:
  `tests/helpers/test-db.ts:20-53` creates a throwaway database
  `zentro_test_<uuid>` per test via `DATABASE_URL` (fallback
  `postgresql://zentro:zentro@localhost:5432/postgres`) and runs the
  migrations from `database/migrations/`. Without Postgres every test fails
  with TCP connection errors. There is no `bunfig.toml` in the repo.
- `.github/workflows/` contains only `desktop-msix.yml` (manual
  `workflow_dispatch` desktop build). No CI for typecheck/lint/test.
- `docker-compose.yml:3,17-19` — local Postgres is `postgres:17-alpine` with
  user/password/db `zentro`/`zentro`/`zentro`.
- Typecheck command is `bunx tsc --noEmit` (per `AGENTS.md`). At the
  planned-at commit it reports exactly one error — a stale local
  `node_modules` missing `@medibase/webusb-receipt-printer` (the package IS
  in `bun.lock`); a fresh `bun install` resolves it.
- Lint command is `bun run check` (Ultracite/Biome, read-only) — currently
  clean: "Checked 468 files … No fixes applied."
- `lefthook.yml` runs `bun x ultracite fix` on pre-commit with
  `stage_fixed: true`. `AGENTS.md` says not to disable `stage_fixed`. Leave
  lefthook alone — CI is the gate being added here.
- Repo conventions: conventional commits (see `git log`, e.g.
  `fix(customers): partial unique index on document number`); `AGENTS.md`
  must be updated when commands/workflows change (its own "## General"
  section says so).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `bun install` | exit 0 |
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run check` | "No fixes applied", exit 0 |
| Start DB | `docker compose up -d postgres` | postgres healthy |
| Tests | `bun test tests/*.test.ts` | "Ran 131 tests across 18 files", 0 fail (see STOP) |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (the `test` script only)
- `.github/workflows/ci.yml` (create)
- `AGENTS.md` (Commands section — document the new test scoping and CI)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `tests/**` — do not "fix" failing tests in this plan; report them instead.
- `lefthook.yml` — pre-commit auto-fix behavior is an intentional convention.
- `playwright.config.ts` and `tests/e2e/**` — Playwright stays separate
  (`bun run e2e:playwright`); do not wire e2e into this CI workflow.
- `desktop/**` and `.github/workflows/desktop-msix.yml`.

## Git workflow

- Branch: `advisor/001-fix-test-gate-and-ci`
- Conventional commits, e.g. `ci: add typecheck/lint/test workflow` and
  `fix(scripts): scope bun test to integration tests`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the local baseline

Run `bun install`, then `bunx tsc --noEmit` and `bun run check`.

**Verify**: both exit 0. If `tsc` still reports the
`@medibase/webusb-receipt-printer` error after a fresh install, STOP (see
STOP conditions).

### Step 2: Scope the `test` script to the integration suite

In `package.json`, change:

```json
"test": "bun test"
```

to:

```json
"test": "bun test tests/*.test.ts"
```

**Verify**: `docker compose up -d postgres`, wait for healthy, then
`bun run test` → "131 pass, 0 fail … Ran 131 tests across 18 files" and **0
Playwright noise** (no "test.describe() in a configuration file" errors).
The 131/131 green baseline was verified at the planned-at commit, so ANY
failure here is new — treat it as a STOP condition, not pre-existing noise.

### Step 3: Create the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, prod]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: zentro
          POSTGRES_PASSWORD: zentro
          POSTGRES_DB: zentro
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U zentro"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://zentro:zentro@localhost:5432/zentro
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx tsc --noEmit
      - run: bun run check
      - run: bun test tests/*.test.ts
```

Notes for the executor:
- The integration tests create their own `zentro_test_*` databases from
  `DATABASE_URL` (see `tests/helpers/test-db.ts:21-28`), so no migration step
  is needed before the test run.
- Do not add a Playwright job — out of scope.

**Verify**: `bunx action-validator .github/workflows/ci.yml` if available;
otherwise validate YAML parses: `bun -e "console.log(require('node:fs').readFileSync('.github/workflows/ci.yml','utf8').length)"` → prints a number, and
visually confirm indentation matches the block above.

### Step 4: Document in AGENTS.md

In `AGENTS.md` "## Commands", update the test bullet to say tests live in
`tests/*.test.ts`, require Postgres (`docker compose up -d postgres`), and
that `bun test` is intentionally scoped to exclude `tests/e2e/` Playwright
specs. Add one bullet noting CI (`.github/workflows/ci.yml`) runs
typecheck + lint + tests on pushes and PRs.

**Verify**: `bun run check` → exit 0 (markdown not linted, but command
confirms nothing else broke).

## Test plan

No new tests. The deliverable is the gate itself:

- `bun run test` with Postgres up runs exactly the 18 integration files.
- CI workflow file exists and encodes the same three checks used locally.

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run check` exits 0
- [ ] `bun run test` (Postgres up) runs 131 tests across 18 files, zero Playwright runner errors
- [ ] `.github/workflows/ci.yml` exists with typecheck, lint, and test steps and a Postgres service
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After a fresh `bun install`, `bunx tsc --noEmit` still reports errors
  (other than zero) — the baseline assumption is a clean typecheck.
- With Postgres up, ANY of the 131 integration tests fail — the verified
  baseline at commit `d97b06e` is 131/131 green, so a failure means the
  codebase drifted; do not patch tests here.
- `bun test tests/*.test.ts` glob expansion does not work in the
  `package.json` script on your platform (e.g. Windows shell) — report
  instead of inventing an alternative runner config.

## Maintenance notes

- Anyone adding a new integration test file must name it `tests/<x>.test.ts`
  (not `.spec.ts`) or the gate won't pick it up.
- A future plan may split pure-logic unit tests out of the DB-bound suite so
  part of the gate runs without Docker; this plan deliberately does not
  restructure tests.
- Playwright e2e in CI was deliberately deferred: it needs zero-cache,
  the dev server, and bootstrap credentials (see `playwright.config.ts`
  webServer entries) — a separate plan should own that.
