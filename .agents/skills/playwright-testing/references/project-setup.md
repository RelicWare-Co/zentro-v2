# Project Setup

Use this when adding or changing Playwright infrastructure in `zentro-v2`.

## Current Repo Context

- Package manager/runtime: Bun.
- App framework: Vike + React, CSR, Hono server.
- Dev app command: `bun run dev`.
- App URL: `http://localhost:3000`.
- Zero dev command: `bun run zero:dev`; requires Postgres and configured Zero env.
- Existing tests: `bun test` for unit tests, Playwright in `tests/e2e/` for web E2E flows.
- No Playwright dependency or config was present when this skill was authored.

## Minimal Install

Use Playwright Test for JS/TS:

```bash
bun add -d @playwright/test
bunx playwright install
```

Add scripts only if the user asks for Playwright to become a first-class repo command:

```json
{
  "e2e:playwright": "playwright test",
  "e2e:playwright:ui": "playwright test --ui",
  "e2e:playwright:debug": "playwright test --debug",
  "e2e:playwright:report": "playwright show-report"
}
```

## Baseline Config

Official docs put runner options at the top level and browser/context options under `use`. Use `webServer` to launch a local server before tests. For this repo, prefer:

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120 * 1000,
  },
});
```

Use multiple `webServer` entries only for flows that require Zero cache:

```ts
webServer: [
  {
    name: "app",
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  {
    name: "zero",
    command: "bun run zero:dev",
    url: process.env.ZERO_CACHE_URL ?? "http://localhost:4848",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
]
```

Before committing a Zero-backed config, verify the actual zero-cache readiness URL/port from repo env and local docs; do not assume `4848` if this repo config differs.

## Browser Projects

Start with one Chromium project for fast feedback. Add projects only when valuable:

```ts
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
]
```

Use setup dependencies for auth or expensive setup:

```ts
projects: [
  { name: "setup", testMatch: /.*\.setup\.ts/ },
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      storageState: "playwright/.auth/user.json",
    },
    dependencies: ["setup"],
  },
]
```

## Auth State

Official docs recommend `playwright/.auth/` and warn that storage state can contain impersonation-capable cookies/headers. Add this to `.gitignore`:

```gitignore
playwright/.auth
```

Use a setup project for shared-account tests that do not mutate shared server state. Use per-worker auth fixtures when tests mutate server-side state and run in parallel.

## File Layout

Recommended first layout:

```text
playwright.config.ts
tests/
  e2e/
    auth.setup.ts
    smoke.spec.ts
    fixtures.ts
    pages/
```

Keep page objects and fixtures under `tests/e2e/` unless they need to be shared with another test type.

## CI Defaults

- `forbidOnly: !!process.env.CI`
- `retries: process.env.CI ? 2 : 0`
- `workers: process.env.CI ? 1 : undefined` for shared local resources; raise workers only after data isolation is solid.
- `trace: "on-first-retry"`, `screenshot: "only-on-failure"`, `video: "on-first-retry"`.
- HTML reporter should not auto-open on CI.

## Git Hygiene

Ignore generated artifacts:

```gitignore
test-results/
playwright-report/
playwright/.auth/
```
