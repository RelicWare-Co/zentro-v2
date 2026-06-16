# Running, Debugging, and CI

Use this when running tests, diagnosing failures, or setting CI behavior.

## Commands

Use package scripts if they exist. Otherwise use Bun's executor:

```bash
bun run e2e:playwright
bun run e2e:playwright:smoke
bunx playwright test tests/e2e/login.spec.ts
bunx playwright test -g "signs in"
bunx playwright test --project=chromium
bunx playwright test --headed
bun run e2e:playwright:ui
bun run e2e:playwright:debug
bunx playwright test --trace on
bun run e2e:playwright:report
```

Official docs note:

- Tests run headless by default.
- Tests run in parallel by default, but this repo config sets `fullyParallel: false` and `workers: 1` because the shared bootstrap account/org and auth cookies are not parallel-safe.
- `--project` selects configured browser/device projects.
- `--ui` opens UI mode with trace-like step exploration and locator tools.
- `--debug` opens the Playwright Inspector.
- `show-report` opens the HTML reporter.

## Narrow Then Broad

For implementation work:

1. Run the exact spec or grep first.
2. Run the affected project, usually Chromium.
3. Run the full suite if the change affects shared auth, routing, config, fixtures, or app shell behavior.

Examples:

```bash
bunx playwright test tests/e2e/orders.spec.ts
bunx playwright test -g "closes a shift"
bunx playwright test --project=chromium
```

## Debugging Workflow

1. Read the Playwright error and call log.
2. If a locator failed, inspect whether the UI exposes the expected role/name/label.
3. Run `bun run e2e:playwright:ui` for local step-through and locator picking.
4. Use `bun run e2e:playwright:debug` for Inspector step-through.
5. If the failure is CI-only, inspect traces, screenshots, videos, and HTML report.
6. Fix the app, state setup, or locator contract. Add waits only as web-first assertions or explicit event waits.

Avoid these first responses to flake:

- `waitForTimeout`.
- Broad CSS selectors.
- `force: true`.
- Marking tests serial without proving order dependency is inherent.
- Raising timeouts before understanding the missed condition.

## Traces and Reports

Recommended config:

```ts
use: {
  trace: "on-first-retry",
  screenshot: "only-on-failure",
  video: "on-first-retry",
}
```

To record traces locally:

```bash
bunx playwright test --trace on
```

Open report:

```bash
bun run e2e:playwright:report
```

Trace viewer lets you inspect actions, DOM snapshots, console, network, source, and errors for each step.

## Retries and Flake Semantics

Official retry behavior:

- Retries are disabled by default.
- When a test fails, Playwright discards the worker process and browser, then continues in a new worker.
- With retries enabled, the failed test is retried in a new worker.
- Results are categorized as passed, flaky, or failed.

Use config:

```ts
retries: process.env.CI ? 2 : 0
```

Use `testInfo.retry` for retry-specific cleanup only when needed:

```ts
test("flow", async ({ page }, testInfo) => {
  if (testInfo.retry) {
    await cleanServerState();
  }
  // ...
});
```

Prefer isolated tests over `test.describe.serial`. Serial mode retries the whole group and skips subsequent tests after a failure.

## CI Checklist

- Install dependencies and browsers before running tests:

```bash
bun install
bunx playwright install --with-deps
```

- Ensure Postgres is running before Playwright tests; the config starts Zero for the suite.
- Run migrations/seeds required by the test environment.
- Set auth/test env variables explicitly when needed: `PLAYWRIGHT_LOGIN_EMAIL`, `PLAYWRIGHT_LOGIN_PASSWORD`, `PLAYWRIGHT_ORG_NAME`, and `PLAYWRIGHT_BASE_URL`. Legacy `MAESTRO_*` names still exist as fallbacks in config/helpers.
- Upload `playwright-report/` and `test-results/` as artifacts on failure.
- Keep `forbidOnly: !!process.env.CI`.
- Use `workers: 1` until server-side data isolation supports higher concurrency.

## Common Failure Patterns

Locator resolves to multiple elements:

- Add accessible name to role locators.
- Scope with `locator.filter({ hasText })`.
- Use `within`-style chaining from a parent locator.

Element not visible:

- Assert the preceding state transition.
- Check route/auth/org state.
- Inspect if hidden text duplicates visible text.

Timeout on click:

- Check actionability: visible, stable, receives events, enabled.
- Look for overlays, disabled buttons, animations, loading states.
- Do not jump to `force` unless the UI intentionally uses nonstandard pointer behavior.

Auth randomly missing:

- Verify `storageState` path.
- Regenerate expired auth.
- Use per-worker state for state-mutating tests.
- Ensure better-auth cookies and org selection are valid for the tested base URL.

Zero data not updating:

- Verify `bun run zero:dev` is running when required.
- Verify Postgres logical replication prerequisites.
- Prefer visible sync state assertions over fixed sleeps.
- Use API/database setup that creates data before navigation when possible.
