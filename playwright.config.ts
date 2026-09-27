import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The managed web server uses `next dev`, so E2E credentials must come from
// development env files. Explicit process env still wins for remote CI targets.
loadEnvConfig(process.cwd(), true);

const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
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
    // The production build also uses webpack. Turbopack's lazy route discovery
    // can omit cold, deeply nested API routes from the development manifest,
    // which makes broad E2E runs fail with transient 404 responses.
    command: `npm run dev -- --webpack --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      // Warming the complete authenticated surface plus two browser contexts
      // can reach Next's 80% heap restart threshold during a mutation. Keep
      // headroom for garbage collection without changing test assertions.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=6144",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
