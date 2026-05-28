# Advanced Topics

Use this when a task goes beyond normal E2E authoring.

## Component Testing

Official Playwright docs mark component testing as experimental. Use it only when the user wants real-browser component tests and the extra setup is worth it.

For React, the official package is `@playwright/experimental-ct-react`. A typical component test mounts a component and receives a locator:

```tsx
import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "@/components/ui/button";

test("click fires handler", async ({ mount }) => {
  let clicked = false;

  const component = await mount(
    <Button onClick={() => {
      clicked = true;
    }}>
      Submit
    </Button>,
  );

  await expect(component).toContainText("Submit");
  await component.click();
  expect(clicked).toBeTruthy();
});
```

Component tests run test code in Node while components run in the browser. Official docs call out limitations:

- Pass only plain serializable props and built-in values.
- Do not pass Node objects into browser components.
- Do not rely on synchronous callback return values from Node into the browser.
- Create test wrapper/story components for complex environments, themes, providers, and browser-only objects.

In this repo, prefer normal unit/component tests with `bun test` unless the user specifically needs real browser layout, events, screenshots, or Playwright tracing for a component.

## Accessibility Testing

Official docs use `@axe-core/playwright` for automated accessibility scans. Automated scans catch some issues but do not replace manual accessibility review.

Install only when adding a11y tests:

```bash
bun add -d @axe-core/playwright
```

Full-page scan:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dashboard has no automatic accessibility violations", async ({ page }) => {
  await page.goto("/dashboard");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
```

Scan UI after interactions by putting the page in the desired state first:

```ts
await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("navigation").waitFor();

const results = await new AxeBuilder({ page })
  .include("nav")
  .analyze();
```

For WCAG A/AA-style automated checks, official docs use:

```ts
await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();
```

For known violations:

- Prefer fixing the UI.
- Use `exclude()` sparingly; it excludes descendants and all rules for that subtree.
- Use `disableRules()` only for explicit known rule IDs.
- Attach full scan results to `testInfo` when debugging.

## Visual Comparisons and Snapshots

Use `await expect(page).toHaveScreenshot()` or `await expect(locator).toHaveScreenshot()` for visual regression. First run writes reference screenshots; later runs compare against them.

```ts
test("receipt layout", async ({ page }) => {
  await page.goto("/receipts/preview");
  await expect(page).toHaveScreenshot("receipt-preview.png");
});
```

Official docs warn browser rendering can vary by OS, browser version, settings, hardware, power source, and headless mode. Only add visual snapshots when CI can generate and compare them in a consistent environment.

Update snapshots intentionally:

```bash
bunx playwright test --update-snapshots
```

Use `stylePath` or targeted locator screenshots to reduce dynamic noise:

```ts
await expect(page).toHaveScreenshot({
  stylePath: "tests/e2e/screenshot.css",
});
```

Text/binary snapshots use `expect(value).toMatchSnapshot(snapshotName)`. Commit snapshot directories only after review.

## Timeouts

Official defaults:

- Test timeout: `30_000` ms. Includes test function, fixture setup, and `beforeEach`.
- Expect timeout: `5_000` ms for auto-retrying assertions.
- Action timeout: no default timeout.
- Navigation timeout: no default timeout.
- Global timeout: none by default.

Prefer improving the waited condition before increasing timeouts. When needed:

```ts
export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
});
```

Single test:

```ts
test("slow report export", async ({ page }) => {
  test.slow();
  // or: test.setTimeout(120_000);
});
```

Single assertion:

```ts
await expect(page.getByText("Export complete")).toBeVisible({ timeout: 30_000 });
```

Use separate fixture timeouts for slow worker-scoped setup instead of inflating every test.

## Parallelism, Workers, and Data Isolation

Official docs:

- Test files run in parallel by default.
- Tests inside one file run in order by default.
- Workers are separate OS processes and cannot communicate.
- Workers shut down after a test failure to preserve a clean environment.
- `fullyParallel` runs all tests in all files in parallel.

Keep this repo conservative until test data isolation is proven:

```ts
workers: process.env.CI ? 1 : undefined,
```

Use `testInfo.workerIndex`, `testInfo.parallelIndex`, `TEST_WORKER_INDEX`, or `TEST_PARALLEL_INDEX` for per-worker data. For example, create a unique organization/account per worker for tests that mutate shared state.

Avoid `serial` unless tests are inherently interdependent. Official docs say isolated tests are usually better; serial groups skip subsequent tests after a failure and retry together.

Sharding across machines:

```bash
bunx playwright test --shard=2/3
```

Limit CI waste on broken suites:

```ts
maxFailures: process.env.CI ? 10 : undefined;
```

## Tags, Annotations, and Focus

Do not commit `test.only`; keep `forbidOnly: !!process.env.CI`.

Built-ins:

- `test.skip`: do not run irrelevant tests.
- `test.fail`: test is expected to fail; runner complains if it passes.
- `test.fixme`: skip known failing/crashing work.
- `test.slow`: triple timeout.

Tags must start with `@`:

```ts
test("login smoke", { tag: "@smoke" }, async ({ page }) => {
  // ...
});

test.describe("reports", { tag: "@reports" }, () => {
  test("exports CSV @slow", async ({ page }) => {
    // ...
  });
});
```

Run by tag:

```bash
bunx playwright test --grep @smoke
bunx playwright test --grep-invert @slow
bunx playwright test --grep "(?=.*@smoke)(?=.*@auth)"
```

Use annotations for richer report metadata:

```ts
test("known edge case", {
  annotation: {
    type: "issue",
    description: "https://github.com/org/repo/issues/123",
  },
}, async ({ page }) => {
  // ...
});
```
