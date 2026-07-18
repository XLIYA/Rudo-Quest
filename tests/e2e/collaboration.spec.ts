import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

import { expect, monitorBrowserErrors, test } from "./fixtures";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdminKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const ownerEmail = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const ownerPassword = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const localSupabase = (() => {
  try {
    const hostname = new URL(supabaseUrl ?? "").hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
})();

test.describe("local collaborative project lifecycle", () => {
  test.skip(
    !localSupabase ||
      !supabaseUrl ||
      !supabaseAdminKey ||
      !databaseUrl ||
      !ownerEmail ||
      !ownerPassword,
    "Local Supabase, database, and seeded owner credentials are required.",
  );

  test("creates a project, accepts an invitation, assigns a task, and completes its lifecycle", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The collaboration flow runs once.");
    // A cold Next.js development server compiles several distinct API routes
    // during this intentionally broad two-user flow.
    test.setTimeout(240_000);
    const suffix = crypto.randomUUID().slice(0, 10);
    const collaboratorEmail = `collab-${suffix}@example.test`;
    const collaboratorPassword = `Collab-${suffix}-Pass!`;
    const collaboratorName = `Collaborator ${suffix}`;
    const projectTitle = `Collaboration ${suffix}`;
    const taskTitle = `Assigned task ${suffix}`;
    const admin = createClient(supabaseUrl!, supabaseAdminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const createdUser = await admin.auth.admin.createUser({
      email: collaboratorEmail,
      password: collaboratorPassword,
      email_confirm: true,
      user_metadata: { name: collaboratorName, time_zone: "UTC" },
    });
    expect(createdUser.error?.message).toBeUndefined();
    const collaboratorUserId = createdUser.data.user?.id;
    expect(collaboratorUserId).toBeTruthy();

    const collaboratorContext = await browser.newContext({ baseURL });
    const collaboratorPage = await collaboratorContext.newPage();
    const collaboratorBrowserAudit = monitorBrowserErrors(collaboratorPage);
    page.setDefaultTimeout(20_000);
    collaboratorPage.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(30_000);
    collaboratorPage.setDefaultNavigationTimeout(30_000);
    let projectId: string | null = null;
    const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 1 });

    try {
      await collaboratorPage.goto("/login");
      await collaboratorPage.getByLabel("Email").fill(collaboratorEmail);
      await collaboratorPage
        .getByLabel("Password", { exact: true })
        .fill(collaboratorPassword);
      const collaboratorSignInPromise = collaboratorPage.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/signin",
      );
      await collaboratorPage.getByRole("button", { name: "Sign in" }).click();
      expect((await collaboratorSignInPromise).status()).toBe(200);
      await expect(collaboratorPage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
      const collaboratorProfile = await collaboratorPage.request.get("/api/me");
      expect(collaboratorProfile.status()).toBe(200);

      await page.goto("/login");
      await page.getByLabel("Email").fill(ownerEmail!);
      await page.getByLabel("Password", { exact: true }).fill(ownerPassword!);
      const ownerSignInPromise = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/signin",
      );
      await page.getByRole("button", { name: "Sign in" }).click();
      expect((await ownerSignInPromise).status()).toBe(200);
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

      const projectListPromise = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === "/api/projects",
      );
      await page.getByRole("link", { name: "Projects" }).click();
      expect((await projectListPromise).status()).toBe(200);
      await expect(page).toHaveURL(/\/projects$/);
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByRole("heading", { name: "Projects", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Create project" }).first().click();
      const createDialog = page.getByRole("dialog", { name: "Create project" });
      await createDialog.getByLabel("Title").fill(projectTitle);
      await createDialog.getByRole("button", { name: "Next" }).click();
      const suggestionsResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === "/api/users/suggest",
      );
      const collaboratorSearch = createDialog.getByLabel("Find collaborator");
      await collaboratorSearch.fill(collaboratorName);
      await expect(collaboratorSearch).toHaveValue(collaboratorName);
      await expect(createDialog).toBeVisible();
      const suggestionsResponse = await suggestionsResponsePromise;
      expect(suggestionsResponse.status()).toBe(200);
      const suggestionsPayload = (await suggestionsResponse.json()) as {
        data: Array<{ id: string; displayName: string }>;
      };
      expect(suggestionsPayload.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: collaboratorUserId,
            displayName: collaboratorName,
          }),
        ]),
      );
      await createDialog.getByText(collaboratorName, { exact: true }).first().click();
      await createDialog.getByRole("button", { name: "Next" }).click();
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/projects",
      );
      await createDialog.getByRole("button", { name: "Create without GitHub" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(201);
      projectId = ((await createResponse.json()) as { data: { id: string } }).data.id;
      await expect(page.getByText(projectTitle, { exact: true })).toBeVisible();

      await collaboratorPage.goto("/notifications");
      const acceptResponsePromise = collaboratorPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname.endsWith("/accept"),
      );
      await collaboratorPage.getByRole("button", { name: "Accept invitation" }).click();
      const acceptResponse = await acceptResponsePromise;
      expect(acceptResponse.status(), await acceptResponse.text()).toBe(200);
      await expect(collaboratorPage).toHaveURL(new RegExp(`/projects/${projectId}$`), {
        timeout: 20_000,
      });

      const origin = new URL(page.url()).origin;
      const scheduledDate = new Date().toISOString().slice(0, 10);
      const taskResponse = await page.request.post("/api/tasks", {
        headers: { origin },
        data: {
          title: taskTitle,
          projectId,
          assigneeId: collaboratorUserId,
          scheduledDate,
          scheduledTimeZone: "UTC",
        },
      });
      expect(taskResponse.status(), await taskResponse.text()).toBe(201);
      const taskId = ((await taskResponse.json()) as { data: { id: string } }).data.id;

      const collaboratorTaskResponse = await collaboratorPage.request.get(
        `/api/tasks/${taskId}`,
      );
      expect(collaboratorTaskResponse.status()).toBe(200);
      const collaboratorTask = (await collaboratorTaskResponse.json()) as {
        data: {
          status: string;
          permissions: { canTransition: boolean; canEditDetails: boolean };
        };
      };
      expect(collaboratorTask.data).toMatchObject({
        status: "TODO",
        permissions: { canTransition: true, canEditDetails: true },
      });

      await collaboratorPage.goto(`/projects/${projectId}`);
      await expect(
        collaboratorPage.getByRole("heading", { name: "This week’s board" }),
      ).toBeVisible();
      await expect(collaboratorPage.getByText(taskTitle, { exact: true })).toBeVisible();

      const moveToProgressResponsePromise = collaboratorPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/tasks/${taskId}/move`,
      );
      await collaboratorPage
        .getByRole("button", { name: `Move ${taskTitle} to In progress` })
        .click();
      expect((await moveToProgressResponsePromise).status()).toBe(200);
      await expect(
        collaboratorPage.getByRole("button", { name: `Move ${taskTitle} to To do` }),
      ).toBeVisible();

      const moveBackResponsePromise = collaboratorPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/tasks/${taskId}/move`,
      );
      await collaboratorPage
        .getByRole("button", { name: `Move ${taskTitle} to To do` })
        .click();
      expect((await moveBackResponsePromise).status()).toBe(200);
      await expect(
        collaboratorPage.getByRole("button", {
          name: `Move ${taskTitle} to In progress`,
        }),
      ).toBeVisible();

      await collaboratorPage.goto(`/weekly?date=${scheduledDate}&task=${taskId}`);
      await collaboratorPage.waitForLoadState("networkidle");
      const taskSheet = collaboratorPage.getByRole("dialog", {
        name: "Task details",
      });
      await expect(taskSheet).toBeVisible();

      const startButton = taskSheet.getByRole("button", { name: "Start", exact: true });
      await expect(startButton).toBeEnabled();
      const startResponsePromise = collaboratorPage.waitForResponse(
        (response) => new URL(response.url()).pathname === `/api/tasks/${taskId}/start`,
      );
      await startButton.click();
      expect((await startResponsePromise).status()).toBe(200);
      await expect(taskSheet.getByText("IN PROGRESS", { exact: true })).toBeVisible();

      const completeResponsePromise = collaboratorPage.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/tasks/${taskId}/complete`,
      );
      await taskSheet.getByRole("button", { name: "Complete", exact: true }).click();
      expect((await completeResponsePromise).status()).toBe(200);
      await expect(taskSheet.getByText("DONE", { exact: true })).toBeVisible();

      const reopenResponsePromise = collaboratorPage.waitForResponse(
        (response) => new URL(response.url()).pathname === `/api/tasks/${taskId}/reopen`,
      );
      await taskSheet.getByRole("button", { name: "Reopen", exact: true }).click();
      expect((await reopenResponsePromise).status()).toBe(200);
      await expect(taskSheet.getByText("IN PROGRESS", { exact: true })).toBeVisible();
    } finally {
      collaboratorBrowserAudit.assertClean();
      await collaboratorContext.close();
      if (projectId) {
        await pool.query("delete from notifications where href like $1", [
          `/projects/${projectId}%`,
        ]);
      }
      await pool.query("delete from projects where title = $1", [projectTitle]);
      await pool.end();
      if (collaboratorUserId) {
        const deleted = await admin.auth.admin.deleteUser(collaboratorUserId);
        expect(deleted.error?.message).toBeUndefined();
      }
    }
  });
});
