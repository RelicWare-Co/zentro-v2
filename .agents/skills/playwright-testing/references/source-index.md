# Source Index

Official source snapshot:

- Repository: `https://github.com/microsoft/playwright`
- Local clone used while authoring: `/tmp/codex-playwright-official`
- Commit: `17c003c41405f38228435a43ec15fd7b5da9be41`
- Commit date: `2026-05-28T10:52:12-07:00`
- Commit subject: `fix(reporter): print inline failure for non-retriable errors (#41026)`

Re-clone when the user asks for latest/current behavior or when a detail could have changed:

```bash
rm -rf /tmp/codex-playwright-official
git clone --depth 1 https://github.com/microsoft/playwright.git /tmp/codex-playwright-official
git -C /tmp/codex-playwright-official rev-parse HEAD
```

## Official Docs Used

- `docs/src/writing-tests-js.md`: basic test shape, actions, assertions, isolation, hooks.
- `docs/src/best-practices-js.md`: user-visible behavior, isolation, locator preference, web-first assertions, avoiding third-party dependency tests.
- `docs/src/locators.md`: locator priority and behavior.
- `docs/src/actionability.md`: auto-waiting/actionability checks and force caveat.
- `docs/src/test-assertions-js.md`: auto-retrying assertions, soft assertions, custom messages, `expect.poll`, `expect.toPass`.
- `docs/src/test-configuration-js.md`: config scopes, `testDir`, `fullyParallel`, `forbidOnly`, `retries`, `workers`, `reporter`, `use`, `projects`, `webServer`, `expect`.
- `docs/src/test-use-options-js.md`: `baseURL`, `storageState`, emulation, network, recording, `testIdAttribute`.
- `docs/src/test-webserver-js.md`: starting one or multiple local servers, readiness URL, `reuseExistingServer`, server env, timeouts.
- `docs/src/test-projects-js.md`: browser/device projects, setup dependencies, environment splitting, `--project`.
- `docs/src/auth.md`: storage state, setup project auth, per-worker accounts, auth-state secrecy.
- `docs/src/test-fixtures-js.md`: built-in fixtures, extending fixtures, worker-scoped fixtures.
- `docs/src/api-testing-js.md`: `request` fixture, API preconditions and postconditions.
- `docs/src/network.md`: route-based network mocking and request/response monitoring.
- `docs/src/running-tests-js.md`: CLI filters, UI mode, headed/debug, reports.
- `docs/src/trace-viewer-intro-js.md`: traces, `--trace on`, reports.
- `docs/src/test-retries-js.md`: retry semantics, worker discard after failures, serial caveat.
- `docs/src/test-components-js.md`: experimental React/Vue component testing with `mount`.
- `docs/src/accessibility-testing-js.md`: axe integration, scan scoping, known issue handling, attachments.
- `docs/src/test-snapshots-js.md`: visual comparisons, snapshot update flow, screenshot determinism.
- `docs/src/test-timeouts-js.md`: test/expect/action/navigation/global/fixture timeouts.
- `docs/src/test-parallel-js.md`: worker model, `fullyParallel`, serial caveat, sharding, worker indexes.
- `docs/src/test-annotations-js.md`: `skip`, `fail`, `fixme`, `slow`, tags, annotations, grep filters.

## Useful Type Sources

- `packages/playwright-test/index.d.ts`
- `packages/playwright-test/reporter.d.ts`
- `packages/playwright-core/types/types.d.ts`
- `docs/src/test-api/class-testconfig.md`
- `docs/src/test-api/class-testoptions.md`
- `docs/src/test-api/class-testproject.md`
- `docs/src/test-api/class-fixtures.md`
- `docs/src/test-api/class-testinfo.md`

## Search Hints

```bash
rg -n "webServer|storageState|expect.poll|testIdAttribute|dependencies|trace|retries|workers" /tmp/codex-playwright-official/docs/src -g '*.md'
rg -n "interface TestConfig|interface TestOptions|storageState|webServer" /tmp/codex-playwright-official/packages/playwright-test/index.d.ts
rg -n "route\\(|APIRequestContext|LocatorAssertions|PageAssertions" /tmp/codex-playwright-official/docs/src -g '*.md'
```
