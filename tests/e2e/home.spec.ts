import { expect, test } from "@playwright/test";

test("renders the KUT foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "KUT Player Ratings" }),
  ).toBeVisible();
});
