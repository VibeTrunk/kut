import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth + 1),
  ).toBeTruthy();
}

test("member can sign in and use core mobile routes", async ({ page }) => {
  await signIn(page, "release_member");
  await expect(page.getByRole("heading", { name: "This week in KUT" })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalOverflow(page);

  for (const route of ["/club/collection", "/club/packs", "/market", "/leaderboard"]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/login$/);
    await expectNoHorizontalOverflow(page);
  }
});

test("admin can reach the mobile attendance finalization surface", async ({ page }) => {
  await signIn(page, "release_admin");
  await page.goto("/admin/attendance");
  await expect(page.getByRole("heading", { name: "Record attendance" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
