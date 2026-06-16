# Project Setup

Use this when adding or changing Playwright infrastructure in `zentro-v2`.

## Current Repo Context

- Package manager/runtime: Bun.
- App framework: Vike + React, CSR, Hono server.
- Dev app command: `bun run dev`.
- App URL: `http://localhost:3000`.
- Zero dev command: `bun run zero:dev`; requires Postgres and configured Zero env.
- Existing tests: `bun test` for integration/unit-style tests, Playwright in `tests/e2e/` for web E2E flows.
- Playwright is already installed and configured. `package.json` exposes `e2e:playwright`, `e2e:playwright:smoke`, `e2e:playwright:ui`, `e2e:playwright:debug`, and `e2e:playwright:report`.
- `playwright.config.ts` uses a setup project (`tests/e2e/auth.setup.ts`) and then a Chromium project that depends on setup.
- The config starts both `bun run dev` and `bun run zero:dev` with `webServer`. The zero readiness URL is `${ZERO_CACHE_URL}/keepalive`, defaulting to `http://localhost:4848/keepalive`.

## Minimal Install

Use Playwright Test for JS/TS:

```bash
bun add -d @playwright/test
bunx playwright install
```

The repo already has these scripts:

```json
{
  "e2e:playwright": "playwright test",
  "e2e:playwright:smoke": "playwright test --grep @smoke",
  "e2e:playwright:ui": "playwright test --ui",
  "e2e:playwright:debug": "playwright test --debug",
  "e2e:playwright:report": "playwright show-report"
}
```

## Baseline Config

Official docs put runner options at the top level and browser/context options under `use`. Use `webServer` to launch local servers before tests. For this repo, keep the active config close to:

```ts
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const zeroCacheURL = process.env.ZERO_CACHE_URL ?? "http://localhost:4848";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "bun run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe",
      timeout: 120_000,
    },
    {
      command: "bun run zero:dev",
      url: `${zeroCacheURL}/keepalive`,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe",
      timeout: 120_000,
    },
  ],
});
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

Current layout:

```text
playwright.config.ts
tests/
  e2e/
    auth.setup.ts
    auth/
    helpers/
    pos/
    products/
```

Keep page objects and fixtures under `tests/e2e/` unless they need to be shared with another test type.

## CI Defaults

- `forbidOnly: !!process.env.CI`
- `retries: process.env.CI ? 2 : 0`
- `workers: 1` for the shared bootstrap account/org; raise workers only after data isolation is solid.
- `trace: "on-first-retry"`, `screenshot: "only-on-failure"`, `video: "on-first-retry"`.
- HTML reporter should not auto-open on CI.

## Git Hygiene

Ignore generated artifacts:

```gitignore
test-results/
playwright-report/
playwright/.auth/
```
