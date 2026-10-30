import { expect, test } from "./fixtures";

test("public landing renders and links to auth", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Rudo Quest").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("uses the original Apple touch icon for every appearance", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator('link[rel="apple-touch-icon"][sizes="180x180"]'),
  ).toHaveAttribute("href", "/apple-touch-icon.png");
  await expect(page.locator('link[rel="apple-touch-icon"][media]')).toHaveCount(0);
});

test("offline route explains mutation limits", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByText("Offline")).toBeVisible();
  await expect(page.getByText(/Mutations stay disabled/)).toBeVisible();
});
