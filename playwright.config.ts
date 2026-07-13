import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The managed web server uses `next dev`, so E2E credentials must come from
// development env files. Explicit process env still wins for remote CI targets.
loadEnvConfig(process.cwd(), true);

const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      // Next's development compiler otherwise reaches its 2 GB heap watcher
      // while the full authenticated route surface is exercised in one run.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
