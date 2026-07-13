import { expect, test } from "./fixtures";

test("public landing renders and links to auth", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Rudo Quest").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("offline route explains mutation limits", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByText("Offline")).toBeVisible();
  await expect(page.getByText(/Mutations stay disabled/)).toBeVisible();
});
