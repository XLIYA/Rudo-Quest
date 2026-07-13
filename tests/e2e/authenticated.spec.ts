import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("authenticated production flow", () => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD are required.");

  test("signs in, creates, renders, and archives a personal task", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email ?? "");
    await page.getByLabel("Password").fill(password ?? "");
    const signInResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/signin"),
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    const signInResponse = await signInResponsePromise;
    expect(
      signInResponse.status(),
      `Sign-in response: ${await signInResponse.text()}`,
    ).toBe(200);
    const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
    expect(
      cookieNames.some((name) => name.startsWith("sb-")),
      `Cookies after sign-in: ${cookieNames.join(", ")}`,
    ).toBe(true);
    const meResponse = await page.request.get("/api/me");
    expect(meResponse.status(), `Profile response: ${await meResponse.text()}`).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Weekly" })).toBeVisible();

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
      await page.goto(`/weekly?date=${scheduledDate}`);
      const browserWeekResponse = await browserWeekResponsePromise;
      expect(
        browserWeekResponse.status(),
        `Browser weekly response: ${await browserWeekResponse.text()}`,
      ).toBe(200);
      await expect(page.getByText(title, { exact: true })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      const archiveResponse = await page.request.delete(`/api/tasks/${created.data.id}`, {
        headers: { origin },
        data: { version: created.data.version },
      });
      expect(
        archiveResponse.status(),
        `Archive response: ${await archiveResponse.text()}`,
      ).toBe(200);
    }
  });
});
