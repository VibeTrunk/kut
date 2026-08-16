import { expect, test } from "@playwright/test";

test("renders the KUT foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "KUT Player Ratings" }),
  ).toBeVisible();
});

test("guides an admin through the attendance preview", async ({ page }) => {
  await page.goto("/admin/attendance");

  await page.getByRole("button", { name: "Alex Example" }).click();
  await page.getByRole("button", { name: /1 selected — enter goals/ }).click();
  await page.getByRole("spinbutton", { name: "Alex Example" }).fill("2");
  await page.getByRole("button", { name: "Review publication" }).click();

  await expect(page.getByRole("heading", { name: "Ready to publish" })).toBeVisible();
});
