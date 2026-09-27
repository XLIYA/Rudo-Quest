import { Pool } from "pg";
import { expect, test } from "./fixtures";

const email = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const password = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
const localDatabase =
  databaseUrl && ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname);

test("responsive navigation, task difficulty, and atomic reward lifecycle", async ({
  page,
}, testInfo) => {
  test.skip(
    !email || !password || !localDatabase,
    "Requires disposable local database and seeded account.",
  );
  test.setTimeout(180_000);
  const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 1 });
  let projectId: string | undefined;
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.setViewportSize({ width: 1920, height: 1111 });
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("[data-app-content]")
          .evaluate((el) => el.scrollHeight - el.clientHeight),
      )
      .toBeLessThanOrEqual(1);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("dashboard-desktop.png"),
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect
      .poll(() =>
        page
          .locator("[data-app-content]")
          .evaluate((el) => el.scrollHeight - el.clientHeight),
      )
      .toBeLessThanOrEqual(1);
    const heatmap = page.getByLabel("Last 13 weeks task completion heatmap");
    expect(
      await heatmap
        .locator("[tabindex]")
        .last()
        .evaluate(
          (cell) =>
            cell.getBoundingClientRect().bottom <=
            cell.closest("section")!.getBoundingClientRect().bottom - 16,
        ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("dashboard-laptop.png"),
    });
    const origin = new URL(page.url()).origin;
    const headers = { origin };
    const projectResponse = await page.request.post("/api/projects", {
      headers,
      data: {
        title: `A deliberately long project title for mobile layout ${crypto.randomUUID().slice(0, 8)}`,
        description: null,
        iconKey: "Rocket",
        colorKey: "orange",
        timeZone: "UTC",
      },
    });
    expect(projectResponse.status()).toBe(201);
    projectId = (await projectResponse.json()).data.id;
    const createdTasks: { id: string; version: number }[] = [];
    for (const difficulty of [2, 5]) {
      const response = await page.request.post("/api/tasks", {
        headers,
        data: {
          title: `Reward task difficulty ${difficulty}`,
          projectId,
          difficulty,
          scheduledDate: new Date().toISOString().slice(0, 10),
          scheduledTimeZone: "UTC",
        },
      });
      expect(response.status()).toBe(201);
      const created = (await response.json()).data;
      expect(created.difficulty).toBe(difficulty);
      createdTasks.push({ id: created.id, version: created.version });
    }
    const staleReward = await page.request.post(`/api/projects/${projectId}/rewards`, {
      headers,
      data: {
        title: "Stale selection",
        amountToman: 10_000_000,
        deadline: "2099-01-01T00:00:00Z",
        tasks: createdTasks.map((task, index) => ({
          ...task,
          version: index === 0 ? 99 : task.version,
        })),
      },
    });
    expect(staleReward.status()).toBe(409);
    expect(
      (await (await page.request.get(`/api/projects/${projectId}/rewards`)).json()).data,
    ).toEqual([]);
    for (const task of createdTasks) {
      const persisted = (await (await page.request.get(`/api/tasks/${task.id}`)).json())
        .data;
      expect(persisted.rewardId).toBeNull();
      expect(persisted.version).toBe(task.version);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/deliberately long/);
    const mobileNav = page.getByRole("navigation", { name: "Mobile primary" });
    await expect(mobileNav.getByRole("link")).toHaveCount(5);
    await expect(mobileNav.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      mobileNav.getByRole("link", { name: "Projects" }).locator("[data-nav-icon]"),
    ).toHaveClass(/bg-brand-soft/);
    await expect(
      page.getByLabel("Difficulty 5 of 5: Very hard", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("project-mobile.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: /Reward task difficulty 5/ })
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("kanban-mobile.png"),
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Add reward", exact: true }).click();
    await page.getByLabel("Reward title").fill("Thursday delivery");
    await page.getByLabel("Total amount (toman)").fill("10000000");
    await page.getByLabel("Approval date", { exact: true }).fill("2099-01-01");
    await page.getByRole("button", { name: "Open Approval date calendar" }).click();
    await expect(page.locator("[data-slot=calendar]")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("reward-calendar-mobile.png"),
      animations: "disabled",
    });
    await page
      .locator("[data-slot=calendar] button[data-day]")
      .filter({ hasText: /^2$/ })
      .click();
    await expect(page.getByLabel("Approval date", { exact: true })).toHaveValue(
      "2099-01-02",
    );
    await page.getByLabel("Approval date", { exact: true }).fill("2099-01-01");
    await page.getByRole("checkbox", { name: "Reward task difficulty 2" }).check();
    await page.getByRole("checkbox", { name: "Reward task difficulty 5" }).check();
    await page.getByRole("button", { name: "Create reward for 2 tasks" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("10,000,000")).toBeVisible();
    await expect(page.locator("article[data-reward=true]")).toHaveCount(3);
    const rewardsResponse = await page.request.get(`/api/projects/${projectId}/rewards`);
    expect(rewardsResponse.status()).toBe(200);
    const reward = (await rewardsResponse.json()).data[0] as {
      id: string;
      taskIds: string[];
      version: number;
    };
    const premature = await page.request.patch(
      `/api/projects/${projectId}/rewards/${reward.id}`,
      { headers, data: { version: reward.version, action: "approve" } },
    );
    expect(premature.status()).toBe(409);
    for (const id of reward.taskIds) {
      const taskResponse = await page.request.get(`/api/tasks/${id}`);
      const task = (await taskResponse.json()).data;
      const complete = await page.request.post(`/api/tasks/${id}/complete`, {
        headers,
        data: { version: task.version },
      });
      expect(complete.status()).toBe(200);
    }
    await page.reload();
    await expect(page.getByRole("button", { name: "Approve reward" })).toBeEnabled();
    await page.getByRole("button", { name: "Approve reward" }).click();
    await expect(page.getByText("Approved · eligible for reward")).toBeVisible();
    await page.goto("/weekly");
    await expect(mobileNav.getByRole("link", { name: "Weekly" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const heading = await page
      .getByRole("heading", { name: "Weekly", exact: true })
      .boundingBox();
    const previous = await page
      .getByRole("button", { name: "Previous week" })
      .boundingBox();
    expect(Math.abs(heading!.y - previous!.y)).toBeLessThan(16);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("weekly-mobile.png"),
      fullPage: true,
    });
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("notifications-mobile.png"),
      fullPage: true,
    });
  } finally {
    if (projectId) {
      // Remove only this test's local fixture, including the circular reward relation.
      await pool.query(
        "update tasks set reward_id = null, version = version + 1 where project_id = $1",
        [projectId],
      );
      await pool.query("delete from projects where id = $1", [projectId]);
    }
    await pool.end();
  }
});
