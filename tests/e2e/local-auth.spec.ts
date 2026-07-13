import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAdminKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const localSupabase = (() => {
  try {
    const hostname = new URL(supabaseUrl ?? "").hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
})();

test.describe("local development authentication", () => {
  test.skip(
    !localSupabase || !supabaseUrl || !supabaseAdminKey,
    "Local Supabase admin credentials are required for the dev auth lifecycle test.",
  );

  test("signs up without email delivery and can sign in again", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The lifecycle runs once per suite.");
    const suffix = crypto.randomUUID().slice(0, 12);
    const email = `rudo-e2e-${suffix}@example.test`;
    const password = `Rudo-${suffix}-Pass!`;
    let userId: string | null = null;
    const admin = createClient(supabaseUrl!, supabaseAdminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
      await page.goto("/signup");
      await page.getByLabel("Display name").fill(`Rudo Tester ${suffix}`);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      const signupResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/auth/signup",
      );
      await page.getByRole("button", { name: "Create account" }).click();
      const signupResponse = await signupResponsePromise;
      expect(signupResponse.status(), await signupResponse.text()).toBe(201);
      const signupPayload = (await signupResponse.json()) as {
        data: { requiresEmailVerification: boolean };
      };
      expect(signupPayload.data.requiresEmailVerification).toBe(false);
      await expect(page).toHaveURL(/\/dashboard$/);

      const meResponse = await page.request.get("/api/me");
      expect(meResponse.status(), await meResponse.text()).toBe(200);
      userId = ((await meResponse.json()) as { data: { id: string } }).data.id;

      const origin = new URL(page.url()).origin;
      const signoutResponse = await page.request.post("/api/auth/signout", {
        headers: { origin },
      });
      expect(signoutResponse.status(), await signoutResponse.text()).toBe(200);

      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      const signinResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/auth/signin",
      );
      await page.getByRole("button", { name: "Sign in" }).click();
      const signinResponse = await signinResponsePromise;
      expect(signinResponse.status(), await signinResponse.text()).toBe(200);
      await expect(page).toHaveURL(/\/dashboard$/);
    } finally {
      if (userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        expect(error?.message).toBeUndefined();
      }
    }
  });
});
