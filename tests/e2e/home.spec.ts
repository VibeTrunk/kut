import { expect, test } from "@playwright/test";

test("requires sign-in before showing Live Ratings", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("keeps the sign-in page usable at a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("requires sign-in before showing the admin attendance flow", async ({ page }) => {
  await page.goto("/admin/attendance");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requires sign-in before showing a published-session correction", async ({ page }) => {
  await page.goto("/admin/attendance/00000000-0000-4000-8000-000000000001");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requires sign-in before showing account recovery", async ({ page }) => {
  await page.goto("/admin/accounts");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requires sign-in before showing admin economy health", async ({ page }) => {
  await page.goto("/admin/economy");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requires sign-in before showing a private collection", async ({ page }) => {
  await page.goto("/club");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("requires sign-in before browsing the transfer market", async ({ page }) => {
  await page.goto("/market");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("keeps a protected route usable at a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/messages");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("requires sign-in before showing a saved pack result", async ({ page }) => {
  await page.goto("/club/packs/00000000-0000-4000-8000-000000000001");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("rejects a malformed invite token without exposing an account flow", async ({ page }) => {
  await page.goto("/invite/not-a-valid-token");

  await page.getByLabel("Email").fill("person@example.test");
  await page.getByLabel("Choose a password").fill("valid-password-123");
  await page.getByRole("button", { name: "Create KUT account" }).click();

  await expect(page.getByText("This invitation is invalid, expired, or has already been used.")).toBeVisible();
});
