# Test Authoring

Use this when writing or reviewing Playwright specs.

## Basic Shape

Official docs describe Playwright tests as actions plus assertions:

```ts
import { expect, test } from "@playwright/test";

test("shows dashboard after login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
```

Use `baseURL` so tests navigate with paths instead of absolute URLs.

## Locator Priority

Prefer locators in this order:

1. `getByRole(role, { name })`
2. `getByLabel()`
3. `getByText()`
4. `getByPlaceholder()`
5. `getByAltText()`
6. `getByTitle()`
7. `getByTestId()`
8. CSS/XPath only as a last resort

Locators resolve fresh before each action, so they survive many React re-renders. Chain and filter locators to narrow scope:

```ts
await page
  .getByRole("listitem")
  .filter({ hasText: "Product 2" })
  .getByRole("button", { name: "Add to cart" })
  .click();
```

When adding app affordances for tests, prefer accessible UI first:

- Add `<label>` for inputs.
- Give buttons meaningful accessible names.
- Use headings/landmarks that match the page structure.
- Use `data-testid` for controls that have no stable user-facing identity.

## Actions and Auto-Waiting

Playwright auto-waits before actions. For `locator.click()`, official docs say it checks that the locator resolves to one element and that the element is visible, stable, receives events, and is enabled.

Do not add fixed waits to "help" actions:

```ts
// Avoid
await page.waitForTimeout(1000);
await page.locator(".submit").click();

// Prefer
await page.getByRole("button", { name: "Submit" }).click();
await expect(page.getByText("Saved")).toBeVisible();
```

Use `force` only after proving the target intentionally cannot receive normal pointer events. It disables non-essential actionability checks and can hide real UX bugs.

## Assertions

Prefer auto-retrying web assertions:

```ts
await expect(page.getByRole("status")).toHaveText("Submitted");
await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
await expect(page).toHaveURL(/\/orders\/\d+/);
```

Avoid manual, non-retrying assertions against locator state:

```ts
// Avoid
expect(await page.getByText("Welcome").isVisible()).toBe(true);

// Prefer
await expect(page.getByText("Welcome")).toBeVisible();
```

Use generic assertions only for already-available values:

```ts
const response = await request.get("/api/dashboard/overview");
expect(response.ok()).toBeTruthy();
```

Use custom messages for diagnostics:

```ts
await expect(
  page.getByText("Name"),
  "user menu should be visible after login",
).toBeVisible();
```

Use `expect.poll` for eventual non-DOM state:

```ts
await expect
  .poll(async () => {
    const response = await request.get("/api/dashboard/overview");
    return response.status();
  })
  .toBe(200);
```

## Isolation

Each test gets an isolated `page` and browser context. Keep tests independently runnable:

- Navigate or set up state inside each test, `beforeEach`, fixtures, API setup, or setup projects.
- Do not depend on test order.
- Do not share mutable page objects between tests unless a serial suite is truly required.
- Prefer a little clear duplication over hidden coupling.

## Fixtures

Built-in fixtures likely needed in this repo:

- `page`: isolated page for the test.
- `context`: isolated browser context containing the page.
- `browser`: shared browser instance.
- `browserName`: `chromium`, `firefox`, or `webkit`.
- `request`: isolated `APIRequestContext`.

Use custom fixtures for reusable setup/teardown:

```ts
import { test as base } from "@playwright/test";

type Fixtures = {
  signedInPage: import("@playwright/test").Page;
};

export const test = base.extend<Fixtures>({
  signedInPage: async ({ page }, use) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "");
    await page.getByLabel("Password").fill(process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await use(page);
  },
});

export { expect } from "@playwright/test";
```

Use worker-scoped fixtures for expensive per-worker setup, especially per-worker auth accounts.

## Authentication

Use setup-project auth for tests without server-side state conflicts:

```ts
// tests/e2e/auth.setup.ts
import { expect, test as setup } from "@playwright/test";
import path from "node:path";

const authFile = path.join(import.meta.dirname, "../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/organizations/);
  await page.context().storageState({ path: authFile });
});
```

Use unique accounts or unique organizations per worker when tests mutate shared state. The official docs recommend per-worker auth for tests that modify server-side state and run in parallel.

## API Testing and State Setup

Use the `request` fixture to:

- Test REST endpoints directly.
- Create deterministic server state before visiting the UI.
- Verify server postconditions after UI actions.

Example:

```ts
test("dashboard reflects new sale", async ({ page, request }) => {
  const create = await request.post("/api/test/seed-sale", {
    data: { total: 1200 },
  });
  await expect(create).toBeOK();

  await page.goto("/dashboard");
  await expect(page.getByText("$1,200")).toBeVisible();
});
```

Only add test-only API helpers if the project accepts that convention; keep them server-only and unavailable in production unless explicitly designed otherwise.

## Network Mocking

Use route mocking for third-party services or nondeterministic endpoints:

```ts
await page.route("**/api/external-price", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ price: 123 }),
  });
});
```

Mock what you do not control. Prefer real app APIs for flows where the point is to validate this app's integration.

## Page Objects

Use page objects when they reduce meaningful duplication. Keep them thin and user-facing:

```ts
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }
}
```

Do not hide assertions so deeply that failures lose user-level meaning.
