import { expect, test } from "./fixtures";
import { Pool } from "pg";

const email = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const localDatabaseUrl = (() => {
  try {
    const targetUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (targetUrl) {
      const targetHostname = new URL(targetUrl).hostname;
      if (targetHostname !== "localhost" && targetHostname !== "127.0.0.1") {
        return null;
      }
    }
    const value = process.env.DATABASE_URL;
    if (!value) return null;
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" ? value : null;
  } catch {
    return null;
  }
})();

test.describe("authenticated production flow", () => {
  test.skip(
    !email || !password,
    "E2E_EMAIL/E2E_PASSWORD or the seeded development credentials are required.",
  );

  test("signs in, creates, renders, and archives a personal task", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email ?? "");
    await page.getByLabel("Password").fill(password ?? "");
    const signInResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/signin"),
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    const signInResponse = await signInResponsePromise;
    expect(signInResponse.status()).toBe(200);
    const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
    expect(
      cookieNames.some((name) => name.startsWith("sb-")),
      `Cookies after sign-in: ${cookieNames.join(", ")}`,
    ).toBe(true);
    const meResponse = await page.request.get("/api/me");
    expect(meResponse.status(), `Profile response: ${await meResponse.text()}`).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await page.waitForLoadState("load");
    await expect(page.getByRole("link", { name: "Weekly" })).toBeVisible({
      timeout: 20_000,
    });

    const origin = new URL(page.url()).origin;
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const title = `E2E task ${testInfo.project.name} ${crypto.randomUUID()}`;
    const createResponse = await page.request.post("/api/tasks", {
      headers: { origin },
      data: {
        title,
        scheduledDate,
        scheduledTimeZone: "UTC",
        projectId: null,
        assigneeId: null,
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      data: { id: string; title: string; version: number };
    };
    let latestVersion = created.data.version;

    try {
      const weekDate = new Date(`${scheduledDate}T00:00:00.000Z`);
      const daysSinceMonday = (weekDate.getUTCDay() + 6) % 7;
      weekDate.setUTCDate(weekDate.getUTCDate() - daysSinceMonday);
      const weekStart = weekDate.toISOString().slice(0, 10);
      const weekResponse = await page.request.get(
        `/api/tasks/week?weekStart=${weekStart}`,
      );
      expect(weekResponse.status(), `Weekly response: ${await weekResponse.text()}`).toBe(
        200,
      );
      const week = (await weekResponse.json()) as {
        data: Array<{ id: string; title: string }>;
      };
      expect(week.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.data.id, title })]),
      );

      const browserWeekResponsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/tasks/week?weekStart="),
        { timeout: 20_000 },
      );
      await page.getByRole("link", { name: "Weekly", exact: true }).click();
      await expect(page).toHaveURL(/\/weekly/);
      const browserWeekResponse = await browserWeekResponsePromise;
      expect(browserWeekResponse.status()).toBe(200);
      await expect(page.getByText(title, { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByText(title, { exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`task=${created.data.id}`));
      const sheet = page.getByRole("dialog", { name: "Task details" });
      await expect(sheet).toBeVisible();

      const startResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/tasks/${created.data.id}/start`,
      );
      await sheet.getByRole("button", { name: "Start", exact: true }).click();
      const startResponse = await startResponsePromise;
      expect(startResponse.status()).toBe(200);
      await expect(sheet.getByText("IN PROGRESS", { exact: true })).toBeVisible();

      const completeResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/tasks/${created.data.id}/complete`,
      );
      await sheet.getByRole("button", { name: "Complete", exact: true }).click();
      const completeResponse = await completeResponsePromise;
      expect(completeResponse.status()).toBe(200);
      await expect(sheet.getByText("DONE", { exact: true })).toBeVisible();

      const reopenResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/tasks/${created.data.id}/reopen`,
      );
      await sheet.getByRole("button", { name: "Reopen", exact: true }).click();
      const reopenResponse = await reopenResponsePromise;
      expect(reopenResponse.status()).toBe(200);
      await expect(sheet.getByText("IN PROGRESS", { exact: true })).toBeVisible();

      const renamedTitle = `${title} renamed`;
      await sheet.getByLabel("Title").fill(renamedTitle);
      const renameResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === `/api/tasks/${created.data.id}`,
      );
      await sheet.getByRole("button", { name: "Save changes" }).click();
      const renameResponse = await renameResponsePromise;
      expect(renameResponse.status()).toBe(200);
      await expect(sheet.getByLabel("Title")).toHaveValue(renamedTitle);
      await sheet.getByRole("button", { name: "Close sheet" }).click();
      await expect(page).not.toHaveURL(/task=/);

      await page.getByRole("button", { name: "Next week" }).click();
      await expect(page).toHaveURL(/weekStart=/);
      await page.getByRole("button", { name: "Today" }).click();
      await expect(page).toHaveURL(/date=/);

      await page.goto("/settings");
      await page.getByLabel("Theme").click();
      const darkThemeResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === "/api/me/preferences",
      );
      await page.getByRole("option", { name: "Dark" }).click();
      expect((await darkThemeResponsePromise).status()).toBe(200);
      await expect(page.locator("html")).toHaveClass(/dark/);

      await page.getByLabel("Theme").click();
      const systemThemeResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === "/api/me/preferences",
      );
      await page.getByRole("option", { name: "System" }).click();
      expect((await systemThemeResponsePromise).status()).toBe(200);

      await page.goto(`/weekly?date=${scheduledDate}`);
      await expect(page.getByText(renamedTitle, { exact: true })).toBeVisible();
      await context.setOffline(true);
      await expect(page.getByText(/Offline\. Changes are disabled/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Add a task/ })).toBeDisabled();
      await context.setOffline(false);
    } finally {
      await context.setOffline(false).catch(() => undefined);
      const currentResponse = await page.request.get(`/api/tasks/${created.data.id}`);
      if (currentResponse.ok()) {
        latestVersion = (
          (await currentResponse.json()) as {
            data: { version: number };
          }
        ).data.version;
      }
      const archiveResponse = await page.request.delete(`/api/tasks/${created.data.id}`, {
        headers: { origin },
        data: { version: latestVersion },
      });
      const archiveStatus = archiveResponse.status();
      const archiveBody = await archiveResponse.text();
      if (localDatabaseUrl) {
        const cleanupPool = new Pool({
          connectionString: localDatabaseUrl,
          ssl: false,
          max: 1,
        });
        try {
          await cleanupPool.query("delete from tasks where id = $1", [created.data.id]);
        } finally {
          await cleanupPool.end();
        }
      }
      expect(archiveStatus, `Archive response: ${archiveBody}`).toBe(200);
    }
  });
});
