import { expect, test as base, type Page } from "@playwright/test";

type BrowserErrorAudit = {
  assertClean: () => void;
};

/**
 * Purpose: Monitor a browser page for uncaught runtime and console errors.
 * Inputs: The Playwright page whose browser output should be audited.
 * Output: An assertion handle that reports all captured browser failures together.
 * Side effects: Registers `pageerror` and `console` listeners on the page.
 * Failure behavior: `assertClean` records a soft test failure when any error was captured.
 */
export function monitorBrowserErrors(page: Page): BrowserErrorAudit {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(`Uncaught at ${page.url()}: ${error.stack ?? error.message}`);
  });
  page.on("console", (message) => {
    const text = message.text();
    const expectedOfflineFailure =
      text === "Failed to load resource: net::ERR_INTERNET_DISCONNECTED";
    if (message.type() === "error" && !expectedOfflineFailure) {
      errors.push(`Console: ${text}`);
    }
  });

  return {
    assertClean: () => {
      expect
        .soft(errors, "The browser must not report runtime or console errors.")
        .toEqual([]);
    },
  };
}

/**
 * Purpose: Apply browser-error auditing automatically to every primary E2E page.
 * Inputs: The base Playwright page fixture and the downstream test callback.
 * Output: The project-standard Playwright test fixture.
 * Side effects: Captures browser errors for the lifetime of each test and asserts afterward.
 * Failure behavior: Browser errors fail the owning test without hiding its primary assertion.
 */
export const test = base.extend<{ browserErrorAudit: void }>({
  browserErrorAudit: [
    async ({ page }, use) => {
      const audit = monitorBrowserErrors(page);
      await use();
      audit.assertClean();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
