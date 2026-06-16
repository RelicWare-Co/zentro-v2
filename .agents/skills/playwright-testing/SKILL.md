---
name: playwright-testing
description: Project-local guide for adding, configuring, writing, running, and debugging Playwright Test suites in zentro-v2. Use when working on Playwright E2E, UI, component, API, auth, fixtures, network mocking, trace/report debugging, flaky test diagnosis, CI/browser projects, or when a user asks how to test this Vike/Bun/Zero app with Playwright.
---

# Playwright Testing

Use this skill as the project goto for Playwright Test work in `zentro-v2`.

The source material was extracted from the official `microsoft/playwright` repository cloned on 2026-05-28 at commit `17c003c41405f38228435a43ec15fd7b5da9be41`. If a task depends on current Playwright behavior, re-clone or update the official repo and verify the relevant docs before changing code.

## Start Here

1. Inspect this repo first: `package.json`, existing test folders, `tests/e2e/`, auth/org flows, Zero usage, and any `playwright.config.*`.
2. If Playwright is not installed, propose or add the smallest setup needed: `@playwright/test`, `playwright.config.ts`, `tests/e2e/`, and package scripts. In this Bun repo, prefer `bunx playwright ...` for commands unless package scripts exist.
3. Read only the reference file needed for the task:
   - `references/project-setup.md`: installing/configuring Playwright for this Vike/Bun/Zero app.
   - `references/test-authoring.md`: locators, assertions, isolation, fixtures, auth, API setup, network mocking.
   - `references/running-debugging-ci.md`: CLI, UI mode, trace viewer, retries, reports, CI and flake workflow.
   - `references/advanced-topics.md`: component testing, accessibility scans, visual snapshots, timeouts, parallelism, tags/annotations.
   - `references/source-index.md`: official Playwright docs files used and when to re-check upstream.
4. When unsure about Playwright behavior, do not guess. Inspect the official repo docs or types. Useful paths after cloning:
   - `docs/src/*-js.md`
   - `docs/src/api/class-*.md`
   - `docs/src/test-api/class-*.md`
   - `packages/playwright-test/index.d.ts`
   - `packages/playwright-core/types/types.d.ts`

## Project Defaults

- Use Playwright for browser-level user flows and REST/browser hybrid checks. Keep `bun test` for unit tests.
- The repo already has `@playwright/test`, package scripts, `playwright.config.ts`, and specs under `tests/e2e/`.
- `playwright.config.ts` always starts both `bun run dev` and `bun run zero:dev` through `webServer` when ports `3000` and `4848` are not already serving. Postgres must already be up.
- The setup project `tests/e2e/auth.setup.ts` runs before Chromium specs and can create a bootstrap account/org when explicit credentials are not supplied.
- Prefer Chromium-only smoke coverage first. Add Firefox/WebKit/mobile projects only when the user wants cross-browser confidence or the feature warrants it.
- Put browser E2E specs under `tests/e2e/**/*.spec.ts` unless the repo has already established another Playwright test directory.
- Put auth state under `playwright/.auth/` and add it to `.gitignore`; do not commit storage state files.
- Do not use CSS/XPath selectors unless there is no user-facing or explicit test contract. Prefer role/name, label, text, alt text, title, then test id.
- Prefer web-first assertions such as `await expect(locator).toBeVisible()` over `expect(await locator.isVisible()).toBe(true)`.
- Avoid fixed sleeps. Rely on locator actionability, web-first assertions, URL assertions, response waits, or `expect.poll`.
- Keep tests isolated. Do not make one test depend on another test's state.

## Standard Workflow

1. Define the user behavior or API contract being tested.
2. Choose the smallest test type:
   - E2E browser flow for visible user behavior across routing/auth/org/Zero.
   - API test with `request` for server contracts or state setup/postconditions.
   - Browser plus API when a UI action needs deterministic state setup or server-side verification.
3. Configure the environment in `playwright.config.ts` before writing many specs.
4. Write locators from user-visible signals. Add accessible labels or test ids to app code when the UI lacks stable handles.
5. Assert final user-visible state and important server postconditions.
6. Run the narrowest command first, then the full Playwright suite if practical.
7. For failures, use UI mode or traces before rewriting waits/selectors.

## Verification

Use these repo commands:

```bash
bun run e2e:playwright
bunx playwright test tests/e2e/some-flow.spec.ts
bun run e2e:playwright:ui
bun run e2e:playwright:debug
bun run e2e:playwright:report
```

If adding scripts in a new repo, prefer names like:

```json
{
  "e2e:playwright": "playwright test",
  "e2e:playwright:ui": "playwright test --ui",
  "e2e:playwright:debug": "playwright test --debug",
  "e2e:playwright:report": "playwright show-report"
}
```

## Source Discipline

- Cite `microsoft/playwright` docs or local reference files in explanations when advising on behavior that may change.
- If Playwright docs and local project constraints conflict, project constraints win for file layout and commands; upstream docs win for Playwright semantics.
- When changing app code only to make tests possible, keep it user-meaningful when possible: accessible names, labels, roles, stable headings. Use `data-testid` only for explicit non-user-facing contracts.
