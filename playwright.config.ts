import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.playwright.local", override: true });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.MAESTRO_BASE_URL ??
  "http://localhost:3000";

const zeroCacheURL =
  process.env.ZERO_CACHE_URL ??
  process.env.VITE_ZERO_CACHE_URL ??
  "http://localhost:4848";

export default defineConfig({
  testDir: "tests/e2e",
  // One bootstrap account/org shared across specs; parallel logins race on auth cookies.
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
