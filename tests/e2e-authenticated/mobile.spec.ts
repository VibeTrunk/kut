import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";
import { COMPLETED_WEEK, resetMidweekMember } from "./midweek-fixture";

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  // Against the device's width, not `innerWidth`: a mobile browser widens its
  // layout viewport to fit an element that is too wide, and `innerWidth` grows
  // with it (a hidden table did that in PR 8).
  const width = page.viewportSize()?.width ?? 0;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, page.url()).toBeLessThanOrEqual(width + 1);
}

/** Compete's tab while it asks for a pick: the word, then what it means (ADR-107). */
const PICK_NAME = /^Compete Pick\. Midweek Madness: you haven't picked your five$/;

/** The visible bar's Compete tab: the bottom bar on a phone, the top bar from `sm`. */
function competeTab(page: Page) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^Compete/ });
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
    "/midweek",
    `/midweek/${COMPLETED_WEEK}`,
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
    // Compete asks for the pick until one is saved (ADR-107).
    await expect(competeTab(page)).toHaveAccessibleName(PICK_NAME);

    await page.goto("/midweek");
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
    await expect(competeTab(page)).toHaveAccessibleName("Compete");
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

    await page.goto("/midweek");
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

test.describe("Compete (ADR-107)", () => {
  test.beforeEach(async () => {
    await resetMidweek("release_member");
  });

  test("Compete owns Midweek, Standings and Players, and the old Midweek links redirect", async ({
    page,
  }) => {
    await signIn(page, "release_member");

    await competeTab(page).click();
    await expect(page).toHaveURL(/\/midweek$/);
    await expect(competeTab(page)).toHaveAttribute("aria-current", "page");
    const sections = page.getByRole("navigation", { name: "Compete" });
    await expect(sections.getByRole("link", { name: "Midweek" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await sections.getByRole("link", { name: "Standings" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Standings" })).toBeVisible();
    await expect(competeTab(page)).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("navigation", { name: "Compete" })
      .getByRole("link", { name: "Players" })
      .click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(competeTab(page)).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalOverflow(page);

    // Permanent redirects keep shared links working (DR1-2).
    await page.goto("/club/midweek");
    await expect(page).toHaveURL(/\/midweek$/);
    await page.goto(`/club/midweek/${COMPLETED_WEEK}`);
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
    await expect(page.getByRole("navigation", { name: "Compete" })).toBeVisible();

    // The Collection strip is gone (Q12): Compete's badge and Home's card replace it.
    await page.goto("/club/collection");
    await expect(page.getByText(/Midweek Madness: pick five of these/)).toHaveCount(0);
  });

  test("on a 1440 px desktop the top bar carries Compete and its badge", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "release_member");
    await expect(competeTab(page)).toHaveAccessibleName(PICK_NAME);
    for (const route of ["/", "/midweek", "/leaderboard", "/players"]) {
      await page.goto(route);
      await expect(competeTab(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("from 640 px to lg the top bar fits the screen (KB-033)", async ({ page }) => {
    await signIn(page, "release_member");
    for (const width of [640, 768, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/midweek", "/market"]) {
        await page.goto(route);
        // Icons only below lg, but every tab keeps its name.
        await expect(competeTab(page)).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Market" }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: /^Settings, / })).toBeInViewport();
        await expectNoHorizontalOverflow(page);
      }
    }
  });
});

test.describe("Midweek Madness results (PR 8)", () => {
  test("a completed week's bracket and a match report fit the screen", async ({ page }) => {
    await signIn(page, "release_member");

    // The picker carries last week's result with the way to its bracket.
    await page.goto("/midweek");
    await expect(page.getByRole("heading", { name: "Pick your five" })).toBeVisible();
    await page.getByRole("link", { name: "Bracket →" }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));

    await expect(page.getByRole("heading", { level: 1, name: /won it$/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Jump to a round" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Final", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who picked whom" })).toBeVisible();
    await expect(page.getByText("✓ Matches the seal.")).toBeAttached();
    await expectNoHorizontalOverflow(page);

    // release_member's own path is marked, and a played match opens its report.
    await expect(page.getByText("You", { exact: true }).first()).toBeVisible();
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/match/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Key moments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why" })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Before kick-off: / })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("from lg, every bracket line meets the match it leads to (KB-031)", async ({ page }) => {
    await signIn(page, "release_member");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    const tree = page.getByTestId("bracket-tree");
    await expect(tree).toBeVisible();
    // The fixture's five entrants leave byes beside matches in round 1, the
    // case the mockups never showed.
    await expect(tree.locator('[data-tree-pair^="1/"]').getByText("Bye")).not.toHaveCount(0);

    const box = async (selector: string) => {
      const found = await tree.locator(selector).boundingBox();
      if (!found) throw new Error(`${selector} has no box`);
      return found;
    };
    const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
    const rounds = await tree.locator("section").count();
    for (let round = 1; round < rounds; round += 1) {
      const groups = await tree.locator(`[data-tree-group^="${round}/"]`).count();
      for (let group = 0; group < groups; group += 1) {
        // The group's bracket line runs from a quarter to three quarters of its
        // height: those ends must be the middles of its two pairings, and its
        // middle the middle of the next round's pairing.
        const outer = await box(`[data-tree-group="${round}/${group}"]`);
        const top = await box(`[data-tree-pair="${round}/${2 * group}"]`);
        const bottom = await box(`[data-tree-pair="${round}/${2 * group + 1}"]`);
        const next = await box(`[data-tree-pair="${round + 1}/${group}"]`);
        const label = `round ${round}, group ${group}`;
        expect(Math.abs(middle(top) - (outer.y + outer.height / 4)), label).toBeLessThanOrEqual(1);
        expect(
          Math.abs(middle(bottom) - (outer.y + (3 * outer.height) / 4)),
          label,
        ).toBeLessThanOrEqual(1);
        expect(Math.abs(middle(next) - middle(outer)), label).toBeLessThanOrEqual(1);
      }
    }
    await expectNoHorizontalOverflow(page);
  });

  test("a bracket URL that isn't a week, or a match that isn't a uuid, is not found", async ({
    page,
  }) => {
    await signIn(page, "release_member");
    for (const url of [
      "/midweek/2001-01-16",
      "/midweek/not-a-week",
      `/midweek/${COMPLETED_WEEK}/match/not-a-uuid`,
    ]) {
      // A streamed page answers before `notFound()` runs, so check the page, not the status.
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "Page not found" }), url).toBeVisible();
    }
  });
});

test("admin can reach the Midweek controls", async ({ page }) => {
  await signIn(page, "release_admin");
  await page.goto("/admin/midweek");
  await expect(page.getByRole("heading", { name: "Midweek Madness", level: 1 })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Running|Paused/ })).toBeVisible();
  // The rehearsal writes nothing, so it is safe to run against the fixture.
  await page.getByRole("button", { name: "Run a rehearsal" }).click();
  await expect(page.getByText(/Last run /)).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalOverflow(page);
  await page.goto("/admin/midweek?void=1");
  await expect(page.getByRole("heading", { name: /^Void / })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("admin can reach the mobile attendance finalization surface", async ({ page }) => {
  await signIn(page, "release_admin");
  await page.goto("/admin/attendance");
  await expect(page.getByRole("heading", { name: "Record attendance" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
