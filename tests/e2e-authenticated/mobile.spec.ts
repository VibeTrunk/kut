import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";
import { resetMidweekMember } from "./midweek-fixture";

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

async function resetMidweek(username: string) {
  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error("Authenticated E2E requires DB_URL.");
  assertLocalTarget(databaseUrl, "DB_URL");
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await resetMidweekMember(database, username);
  } finally {
    await database.end();
  }
}

test("member can sign in and use core mobile routes", async ({ page }) => {
  await signIn(page, "release_member");
  await expect(page.getByRole("heading", { name: "This week in KUT" })).toBeVisible({
    timeout: 15_000,
  });
  await expectNoHorizontalOverflow(page);

  for (const route of [
    "/club/collection",
    "/club/packs",
    "/club/midweek",
    "/market",
    "/leaderboard",
  ]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/login$/);
    await expectNoHorizontalOverflow(page);
  }
});

test.describe("Midweek Madness entry (PR 7)", () => {
  const five = [
    "Keeper Fixture",
    "Winger Fixture",
    "Striker Fixture",
    "Wall Fixture",
    "Engine Fixture",
  ];

  test.beforeEach(async () => {
    await resetMidweek("release_member");
  });

  test("member picks five cards, saves, and sees them saved after a reload", async ({ page }) => {
    await signIn(page, "release_member");
    await expect(page.getByRole("link", { name: /Pick your five/ })).toBeVisible();

    await page.goto("/club/midweek");
    await expect(page.getByRole("heading", { name: "Pick your five" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Not picked yet" })).toBeVisible();
    // One tile per Player: the second copy is a badge, not a sixth tile.
    await expect(page.getByText("×2 copies")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    for (const name of five) {
      await page
        .getByRole("button", { name: new RegExp(`^(Put in slot \\d|Add to your five): ${name}`) })
        .click();
    }
    await expect(page.getByText("Keeper Fixture goes in goal.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();

    await page.getByRole("button", { name: "Save your five" }).click();
    await expect(page.getByText("Saved. Your five play on Wednesday.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible();
    await expect(page.getByRole("button", { name: "✓ Saved" })).toBeDisabled();
    await expect(page.getByText("✓ In your five")).toHaveCount(five.length);
    await expectNoHorizontalOverflow(page);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Your five are in/ })).toBeVisible();
  });

  test("the settings opt-out toggles, and the picker offers the way back", async ({ page }) => {
    await signIn(page, "release_member");
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "Midweek Madness" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expectNoHorizontalOverflow(page);

    await toggle.click();
    await expect(page.getByText("Opt out of Midweek Madness?")).toBeVisible();
    await page.getByRole("button", { name: "Opt out", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("You’ve opted out", { exact: true })).toBeVisible();

    await page.goto("/club/midweek");
    await expect(page.getByRole("heading", { name: "You’re sitting this out" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Take part again" }).click();
    await expect(page.getByRole("heading", { name: "Pick your five" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("switch", { name: "Midweek Madness" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test("admin can reach the mobile attendance finalization surface", async ({ page }) => {
  await signIn(page, "release_admin");
  await page.goto("/admin/attendance");
  await expect(page.getByRole("heading", { name: "Record attendance" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
