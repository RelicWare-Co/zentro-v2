# Plan 012: Split the largest modules so each concern is independently testable and reviewable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ac183ef..HEAD -- features/restaurants/ features/dashboard/ features/shifts/shifts.shared.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MEDIUM
- **Depends on**: 008 (typecheck gate must be green to verify changes)
- **Category**: debt
- **Planned at**: commit `4ac183ef`, 2026-07-08

## Why this matters

Several modules exceed 600–1300 lines, making them hard to test, review, and
patch. Changes to one concern require opening a massive file, and merge
conflicts are more likely. Splitting the largest modules by operation domain
keeps each file focused on a single concern, following the existing
`features/<domain>/<operation>.server.ts` pattern documented in AGENTS.md.
This is pure refactoring — extract-and-re-export only, no behavioral changes.

## Current state — the largest modules

1. `features/restaurants/restaurant-mutations.server.ts` — 1,283 lines
2. `features/pos/printing/printer-manager.client.ts` — 962 lines
3. `features/shifts/shifts.shared.ts` — 898 lines
4. `features/dashboard/build-overview.server.ts` — 842 lines
5. `features/sales/create-sale.server.ts` — 664 lines

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0, no output |
| Lint | `bun run fix && bun run check` | exit 0 |
| Tests (restaurants) | `docker compose up -d postgres && bun test tests/restaurants.test.ts` | all pass |
| Tests (dashboard) | `docker compose up -d postgres && bun test tests/dashboard.test.ts` | all pass |
| Tests (shifts) | `docker compose up -d postgres && bun test tests/shifts.test.ts tests/pos.test.ts` | all pass |

## Scope

**In scope**:
- The files being split (new files created, old files updated to re-export):
  - `features/restaurants/restaurant-mutations.server.ts` (Phase 1)
  - `features/dashboard/build-overview.server.ts` (Phase 2)
  - `features/shifts/shifts.shared.ts` (Phase 3)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any behavioral changes — this is pure refactoring, extract-and-re-export
  only. No logic changes, no query changes, no type changes beyond what is
  needed to move code between files.
- `features/pos/printing/printer-manager.client.ts` and
  `features/sales/create-sale.server.ts` — these are more cohesive
  single-responsibility modules; splitting them is lower priority and higher
  risk. Documented as deferred (Phase 4).
- `features/posv2/**`.

## Git workflow

- Branch: `advisor/012-split-large-modules`
- Conventional commit per phase, e.g.
  `refactor(restaurants): split restaurant-mutations by operation domain`.
- Do NOT push or open a PR unless instructed.

## Steps

This is a **phased** plan — not all modules need to be split at once. Phases
are prioritized by size and churn. Run `bunx tsc --noEmit` and
`bun run check` after EACH phase, and run the relevant integration tests
after each phase.

### Phase 1: Split `features/restaurants/restaurant-mutations.server.ts` (1,283 lines) — highest impact

This server module likely contains multiple restaurant operations (order
creation, item modifications, kitchen ticket management, table operations,
etc.). Split by operation domain into separate `.server.ts` files following
the existing pattern (`features/<domain>/<operation>.server.ts`).

1. Read `features/restaurants/restaurant-mutations.server.ts` in full and
   identify the distinct operation domains it contains. Group exported
   functions by the concern they serve (e.g. order creation, item
   modifications, kitchen ticket management, table operations).
2. For each operation domain, create a new file
   `features/restaurants/<operation>.server.ts` and move the relevant
   functions (and their private helpers) into it. Preserve the Vike
   `.server.ts` suffix on every new file.
3. Update `features/restaurants/restaurant-mutations.server.ts` to re-export
   everything from the new files, so all existing import sites continue to
   work unchanged:
   ```ts
   export * from "./<operation>.server.ts";
   ```
4. Keep shared imports (Drizzle schema, auth helpers, etc.) in each new file
   as needed — do not introduce a shared barrel beyond the original file's
   re-exports.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0; `docker compose up -d postgres && bun test tests/restaurants.test.ts`
→ all pass.

### Phase 2: Split `features/dashboard/build-overview.server.ts` (842 lines)

Extract sub-queries (sales aggregation, product performance, shift summary,
credit summary) into separate `features/dashboard/*.server.ts` files.

1. Read `features/dashboard/build-overview.server.ts` in full and identify
   the sub-query functions (sales aggregation, product performance, shift
   summary, credit summary).
2. For each sub-query, create a new file
   `features/dashboard/<sub-query>.server.ts` and move the relevant function
   (and its private helpers) into it. Preserve the `.server.ts` suffix.
3. Update `features/dashboard/build-overview.server.ts` to import the
   extracted functions from the new files and re-export them if any external
   import site depends on them:
   ```ts
   export * from "./<sub-query>.server.ts";
   ```
4. The main `buildOverview` orchestrator function stays in
   `build-overview.server.ts` and calls the extracted sub-queries.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0; `docker compose up -d postgres && bun test tests/dashboard.test.ts`
→ all pass.

### Phase 3: Split `features/shifts/shifts.shared.ts` (898 lines)

Extract the summary builders (`buildShiftListItem`,
`buildExpectedAmountsByMethod`, `buildShiftOperations`,
`buildShiftCloseSummary`) from the filter/pagination helpers
(`filterShiftsClientRefinements`, `buildShiftsListPage`,
`normalizeShiftsListLimit`) and the product summary builders
(`ShiftProductSummary*`).

1. Read `features/shifts/shifts.shared.ts` in full and identify the three
   groups of functions:
   - **Summary builders**: `buildShiftListItem`,
     `buildExpectedAmountsByMethod`, `buildShiftOperations`,
     `buildShiftCloseSummary`.
   - **Filter/pagination helpers**: `filterShiftsClientRefinements`,
     `buildShiftsListPage`, `normalizeShiftsListLimit`.
   - **Product summary builders**: `ShiftProductSummary*` functions.
2. Create new `.shared.ts` files for each group (e.g.
   `features/shifts/shift-summary.shared.ts`,
   `features/shifts/shift-list-helpers.shared.ts`,
   `features/shifts/shift-product-summary.shared.ts`). Preserve the
   `.shared.ts` suffix — these are isomorphic, browser-safe helpers.
3. Move each group of functions (and their private helpers) into the
   corresponding new file.
4. Update `features/shifts/shifts.shared.ts` to re-export everything from
   the new files, so all existing import sites continue to work unchanged:
   ```ts
   export * from "./shift-summary.shared.ts";
   export * from "./shift-list-helpers.shared.ts";
   export * from "./shift-product-summary.shared.ts";
   ```

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run fix && bun run check` →
exit 0; `docker compose up -d postgres && bun test tests/shifts.test.ts tests/pos.test.ts`
→ all pass.

### Phase 4 (deferred): `printer-manager.client.ts` and `create-sale.server.ts`

`features/pos/printing/printer-manager.client.ts` (962 lines) and
`features/sales/create-sale.server.ts` (664 lines) are more cohesive
single-responsibility modules; splitting them is lower priority and higher
risk. Document as deferred — do NOT split in this plan. If a future plan
takes these on, assess cohesion carefully before extracting.

## Test plan

No new tests needed — this is pure refactoring (extract-and-re-export). The
existing integration tests for each domain (restaurants, dashboard, shifts,
POS) cover the behavior being preserved. Run the relevant test suite after
each phase as specified in the step verification commands.

## Done criteria

- [ ] `features/restaurants/restaurant-mutations.server.ts` is split by
  operation domain into separate `.server.ts` files; the original file
  re-exports from the new files
- [ ] `features/dashboard/build-overview.server.ts` is split by sub-query
  into separate `.server.ts` files; the original file re-exports from the
  new files
- [ ] `features/shifts/shifts.shared.ts` is split by function group into
  separate `.shared.ts` files; the original file re-exports from the new
  files
- [ ] All existing import sites continue to work (no import path changes
  required)
- [ ] `bunx tsc --noEmit` exits 0 after each phase
- [ ] `bun run check` exits 0 after each phase
- [ ] Relevant integration tests pass after each phase
- [ ] `git status` shows no modified files outside in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Any in-scope file has changed since this plan was written (drift) and the
  "Current state" line counts no longer match the live code.
- Splitting a module requires changing its behavior (not just moving code
  and re-exporting) — report the exact behavioral change that cannot be
  avoided.
- An existing import site cannot be satisfied by a re-export from the
  original file (e.g. a default export, a type-only import, or a named
  import that the `export *` pattern does not cover) — report the exact
  import and the error.
- Any integration test fails after a phase — report the test name and
  assertion that broke.
- A new file cannot carry the correct Vike environment suffix (e.g. a
  `.shared.ts` file needs to import a `.server.ts` dependency) — report the
  boundary violation; do not suppress it.

## Maintenance notes

- **Phase 4 (deferred)**: `features/pos/printing/printer-manager.client.ts`
  (962 lines) and `features/sales/create-sale.server.ts` (664 lines) are
  more cohesive single-responsibility modules. Splitting them is lower
  priority and higher risk. If a future plan takes these on, assess
  cohesion carefully — `printer-manager.client.ts` manages a single printer
  lifecycle and `create-sale.server.ts` orchestrates a single sale creation
  flow. Forcing a split may create artificial seams.
- **Re-export strategy**: the original files re-export from the new files
  so existing import sites do not change. Once all consumers are migrated
  to import directly from the new files, the re-exports can be removed in a
  follow-up cleanup.
- **Naming convention**: follow the existing feature module pattern from
  AGENTS.md: `<domain>.<role>.ts` naming with Vike environment suffixes
  (`.server.ts`, `.shared.ts`, `.client.ts`). New files must maintain the
  same suffix as the code they hold.
- If `posv2` ever replaces `pos`, revisit whether
  `printer-manager.client.ts` is still the right split boundary.
