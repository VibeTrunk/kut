import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";
import {
  advanceFixtureEvening,
  COMPLETED_WEEK,
  endFixtureEvening,
  resetMidweekMember,
  setWeekArchetype,
  startFixtureEvening,
} from "./midweek-fixture";

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

/**
 * The match page's Why (ADR-111): every card in team colour with its Power,
 * `Show every factor` opens five boxes per card, and a factor's explanation
 * shows on focus and closes on Escape, all inside the screen.
 */
async function expectMatchPageWhy(page: Page) {
  const why = page.getByRole("region", { name: /’s five$/ });
  await expect(why).toHaveCount(2);
  await expect(
    why.first().getByText(/ power, (strong|above ordinary|below ordinary|weak)$/),
  ).toHaveCount(5);
  await page.getByRole("button", { name: "Show every factor" }).click();
  await expect(page.getByRole("button", { name: "Hide the factors" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const form = page.getByRole("button", { name: "Form", exact: true }).first();
  await expect(form).toHaveAccessibleDescription(/^The Player's form this week/);
  await form.focus();
  const tip = page
    .getByRole("tooltip")
    .filter({ hasText: /^The Player's form this week/ })
    .first();
  await expect(tip).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
}

/** A picker card's button, whether it adds to the five or fills the slot being chosen. */
const PICK_BUTTON = /^(Put in slot \d|Add to your five): /;

/** Compete's tab while it asks for a pick: the word, then what it means (ADR-107). */
const PICK_NAME = /^Compete Pick\. Midweek Madness: you haven't picked your five$/;

/** The visible bar's Compete tab: the bottom bar on a phone, the top bar from `sm`. */
function competeTab(page: Page) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^Compete/ });
}

async function withDatabase(work: (database: Client) => Promise<void>) {
  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error("Authenticated E2E requires DB_URL.");
  assertLocalTarget(databaseUrl, "DB_URL");
  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await work(database);
  } finally {
    await database.end();
  }
}

async function resetMidweek(username: string) {
  await withDatabase((database) => resetMidweekMember(database, username));
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
    // One row per Player: the second copy is a note, not a sixth row.
    await expect(page.getByText(/×2 copies/).filter({ visible: true })).toHaveCount(1);
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
    await expect(page.getByRole("button", { name: "Change your five" })).toBeVisible();
    await expect(page.getByText(/^✓ In/).filter({ visible: true })).toHaveCount(five.length);
    await expectNoHorizontalOverflow(page);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Your five are in/ })).toBeVisible();
    await expect(competeTab(page)).toHaveAccessibleName("Compete");
  });

  test("the picker filters by archetype, keeps Save in reach, and names a coming archetype (KB-028/029)", async ({
    page,
  }) => {
    await withDatabase((database) => setWeekArchetype(database, "Winger Fixture", "goalkeeper"));
    await signIn(page, "release_member");
    await page.goto("/midweek");
    await expect(page.getByText(/^Squads lock /)).toBeVisible();
    // KB-028 in the phone list: the week's archetype, and the change in words.
    await expect(
      page.getByText("Goalkeeper this week, Speedster from next").filter({ visible: true }),
    ).toHaveCount(1);

    // The archetype filter is instant; Goalkeepers counts the week's archetype.
    const filter = page.getByRole("group", { name: "Filter your cards by archetype" });
    await filter.getByRole("button", { name: "Goalkeepers 2" }).click();
    await expect(filter.getByRole("button", { name: "Goalkeepers 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: PICK_BUTTON })).toHaveCount(2);
    await filter.getByRole("button", { name: /^All / }).click();
    await expect(page.getByRole("button", { name: PICK_BUTTON })).toHaveCount(5);

    // Unsaved changes on a phone: one compact row stays above the tab bar.
    await page.getByRole("button", { name: /: Striker Fixture$/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
    await page.getByRole("button", { name: /: Engine Fixture$/ }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Save your five" })).toBeInViewport();
    await expectNoHorizontalOverflow(page);

    // From lg: the card face says what the Player plays from next week, and
    // the team sheet says it under the card.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText("Speedster from next week").filter({ visible: true })).toHaveCount(
      1,
    );
    await page.getByRole("button", { name: /: Winger Fixture$/ }).click();
    await expect(
      page.getByText("Goalkeeper this week, Speedster from next").filter({ visible: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Speedster from next week").filter({ visible: true })).toHaveCount(
      2,
    );
    await expectNoHorizontalOverflow(page);
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
    await expect(page.getByRole("navigation", { name: "Jump to" })).toBeVisible();
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

    await expectMatchPageWhy(page);
  });

  test("on a 1440 px desktop a match report puts the Why beside the story", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "release_member");
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/match/[0-9a-f-]{36}$`));
    const story = await page.getByRole("list", { name: "Key moments" }).boundingBox();
    const why = await page.getByRole("heading", { name: "Why" }).boundingBox();
    expect(why!.x).toBeGreaterThan(story!.x + story!.width);
    await expectNoHorizontalOverflow(page);
    await expectMatchPageWhy(page);
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

  test("past weeks list every finished week, each opening its bracket", async ({ page }) => {
    await signIn(page, "release_member");
    await page.goto("/midweek/past");
    await expect(page.getByRole("heading", { level: 1, name: "Past weeks" })).toBeVisible();
    const week = page
      .getByRole("list", { name: "Past weeks" })
      .getByRole("link", { name: / won it · \d+ entrants\. You/ })
      .last();
    await expect(week).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await week.click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
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

/** The sticky `MidweekClock`, named by its one-sentence label. */
const eveningClock = (page: Page) =>
  page.getByRole("list", { name: /^Wednesday evening: Lock \d\d:\d\d, locked; / });

/** The clock stays under the app header however far the page scrolls. */
async function expectClockPinned(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const box = await page.getByTestId("midweek-clock").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThanOrEqual(80);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("Midweek Madness evening from the lock (F5, ADR-113)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("from the lock: the draw, every five, kick-off times and the bracket", async ({ page }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");

    await expect(page.getByRole("heading", { level: 1, name: "The draw is out" })).toBeVisible();
    await expect(eveningClock(page)).toHaveAccessibleName(
      // The first round after the lock, named from the end ("Quarters" with 5–8 entrants).
      /locked; [\w ]+ \d\d:\d\d, next, you're in;/,
    );
    await expect(page.getByRole("heading", { name: "Your first match" })).toBeVisible();
    // release_member's auto squad, and one or two opponents' fives, from the lock.
    const fives = page.getByRole("region", { name: /’s five$/ });
    expect(await fives.count()).toBeGreaterThanOrEqual(2);
    await expect(fives.first().getByText("Auto squad")).toBeVisible();
    await expect(page.getByText(/^Form, pick boost and the chances before kick-off/)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /^(Round 1|Quarter-finals|Semi-finals)$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: /, kick-off \d\d:\d\d\.$|has a bye, which counts/ }).first(),
    ).toBeVisible();
    // Nothing is played yet: no full-time row, no report link.
    await expect(page.getByRole("link", { name: /^Match report: / })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    // KB-034: with `Live` on Midweek, Compete's tabs stay inside the page's
    // 20 px gutter, which the page-width check alone can't see.
    const tabs = await page.getByRole("navigation", { name: "Compete" }).boundingBox();
    expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 19);
    await expectClockPinned(page);

    await page.getByRole("link", { name: "Full bracket →" }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${weekStart}$`));
    await expect(page.getByRole("heading", { level: 1, name: "The bracket" })).toBeVisible();
    await expect(eveningClock(page)).toBeVisible();
    const jump = page.getByRole("navigation", { name: "Jump to" });
    await expect(jump.getByRole("link", { name: /^Your match · R\d \d\d:\d\d$/ })).toBeVisible();
    await expect(page.getByText(/^Kick-off \d\d:\d\d$/).first()).toBeVisible();
    await expect(page.getByText(/^Winner(,| of) /).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("between rounds: results at full time, the next kick-offs and your night", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
      // Round 1 (lock + 5) has ended, even with 50 kicks (8:55); round 2 kicks
      // off in four minutes (lock + 20).
      await advanceFixtureEvening(database, 15);
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /^(Round 2 is live|(Quarter|Semi)-finals are live|You’re out|The final is live)$/,
      }),
    ).toBeVisible();
    await expect(eveningClock(page)).toHaveAccessibleName(/locked; [\w ]+ \d\d:\d\d, played/);
    await expect(page.getByRole("heading", { name: "Your night" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your night" })).toBeVisible();
    await expect(page.getByRole("group", { name: / won\.$/ }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectClockPinned(page);

    await page.goto(`/midweek/${weekStart}`);
    await expect(page.getByRole("link", { name: /^Match report: / }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
  });

  test("after the final: the champion, the placeholders and the way to past weeks", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    await withDatabase(async (database) => {
      await startFixtureEvening(database);
      // Long past the end of any final: the worker pays and completes the week.
      await advanceFixtureEvening(database, 120, { runWorker: true });
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");

    await expect(page.getByText(/· Champion$/)).toBeVisible();
    await expect(page.getByTestId("midweek-clock")).toHaveCount(0);
    await expect(page.getByRole("note").filter({ hasText: "Your five’s ratings" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "Share your night" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Past weeks →" }).click();
    await expect(page).toHaveURL(/\/midweek\/past$/);
    await expect(page.getByRole("heading", { level: 1, name: "Past weeks" })).toBeVisible();
  });

  test("on a 1440 px desktop the fives sit side by side and the tree shows kick-offs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
    });
    await signIn(page, "release_member");
    await page.goto("/midweek");
    await expect(page.getByRole("heading", { level: 1, name: "The draw is out" })).toBeVisible();
    const fives = page.getByRole("region", { name: /’s five$/ });
    const mine = await fives.first().boundingBox();
    const theirs = await fives.nth(1).boundingBox();
    expect(theirs!.x).toBeGreaterThan(mine!.x + mine!.width);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}`);
    const tree = page.getByTestId("bracket-tree");
    await expect(tree).toBeVisible();
    await expect(tree.getByText(/^Kick-off \d\d:\d\d$/).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Jump to" })).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });
});

/** The fixture evening's matches in one round, and release_member's id. */
async function roundMatches(weekStart: string, round: number) {
  let result: {
    member: string;
    matches: { id: string; side_0_user_id: string; side_1_user_id: string }[];
  } = { member: "", matches: [] };
  await withDatabase(async (database) => {
    const member = await database.query<{ id: string }>(
      "select id from kut.profiles where username = 'release_member'",
    );
    const matches = await database.query<{
      id: string;
      side_0_user_id: string;
      side_1_user_id: string;
    }>(
      `select m.id, m.side_0_user_id, m.side_1_user_id from kut.midweek_matches m
       join kut.midweek_tournaments t on t.id = m.tournament_id
       where t.week_start = $1 and m.round = $2 and not m.bye order by m.pairing`,
      [weekStart, round],
    );
    result = { member: member.rows[0].id, matches: matches.rows };
  });
  return result;
}

test.describe("Midweek Madness live (F6, ADR-115)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("a match in play: your own live, every other in play, no result before full time", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    await withDatabase(async (database) => {
      ({ weekStart } = await startFixtureEvening(database));
      // Round 1 kicked off a minute ago.
      await advanceFixtureEvening(database, 5);
    });
    const { member, matches } = await roundMatches(weekStart, 1);
    const isMine = (m: (typeof matches)[number]) =>
      m.side_0_user_id === member || m.side_1_user_id === member;
    const match = matches.find(isMine) ?? matches[0];
    const mine = isMine(match);
    const other = matches.find((m) => !isMine(m));
    await signIn(page, "release_member");

    const home = page.getByRole("region", { name: "Now" }).getByRole("link").first();
    await expect(home).toContainText("Live");
    await expectNoHorizontalOverflow(page);

    await page.goto("/midweek");
    await expect(page.getByText(/^Updated \d\d:\d\d:\d\d$/)).toBeVisible();
    await expect(eveningClock(page)).toHaveAccessibleName(/locked; [\w ]+ \d\d:\d\d, live/);
    if (mine) {
      await expect(page.getByRole("heading", { name: "Your match" })).toBeVisible();
      await expect(page.getByRole("group", { name: /^Live, / })).toBeVisible();
      await expect(page.getByRole("link", { name: "Watch it →" })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "This round" })).toBeVisible();
    if (other) {
      await expect(
        page.getByRole("group", { name: /, in play\. The result shows at full time\.$/ }).first(),
      ).toBeVisible();
    }
    // Nothing about round 1 reads as played yet.
    await expect(page.getByRole("group", { name: / won\.$/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}`);
    await expect(page.getByRole("navigation", { name: "Jump to" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Match report: / })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/midweek/${weekStart}/match/${match.id}`);
    if (mine) {
      await expect(page.getByText(/· your match · live$/)).toBeVisible();
      await expect(page.getByRole("group", { name: /^Live, / })).toBeVisible();
      await expect(page.getByText("A new chance every 20 seconds")).toBeVisible();
    } else {
      await expect(page.getByText(/ · in play$/)).toBeVisible();
      await expect(page.getByText(/^You’re not in this match, so it isn’t shown/)).toBeVisible();
      await expect(page.getByRole("region", { name: /’s line-up$/ })).toHaveCount(2);
    }
    await expect(page.getByText(/· checks for new chances every 20 seconds$/)).toBeVisible();
    await expect(page.getByText(/Goals and assists are added at full time\./)).toBeVisible();
    await expect(page.getByRole("group", { name: /^Final score:/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    if (mine && other) {
      await page.goto(`/midweek/${weekStart}/match/${other.id}`);
      await expect(page.getByText(/ · in play$/)).toBeVisible();
      await expect(page.getByText(/^You’re not in this match, so it isn’t shown/)).toBeVisible();
      await expect(page.getByRole("region", { name: /’s line-up$/ })).toHaveCount(2);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the final is live for everyone, on the evening and its own page", async ({ page }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    let rounds = 0;
    await withDatabase(async (database) => {
      ({ weekStart, rounds } = await startFixtureEvening(database));
      // The final kicked off a minute ago: lock + 5 + 15 × (rounds − 1).
      await advanceFixtureEvening(database, 5 + 15 * (rounds - 1));
    });
    const { matches } = await roundMatches(weekStart, rounds);
    await signIn(page, "release_member");
    await page.goto("/midweek");
    await expect(page.getByRole("heading", { level: 1, name: "The final is live" })).toBeVisible();
    await expect(page.getByRole("group", { name: /^Live, / })).toBeVisible();
    await expect(
      page.getByText(/^The champion is named and coins are paid when the final ends\./),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/midweek/${weekStart}/match/${matches[0].id}`);
    await expect(page.getByText(/^The final · live$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it went" })).toBeVisible();
    const story = await page.getByRole("heading", { name: "How it went" }).boundingBox();
    const why = await page.getByRole("heading", { name: "Why" }).boundingBox();
    // From lg the Why sits beside the story.
    expect(why!.x).toBeGreaterThan(story!.x + 200);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Home and Messages (F4, ADR-114)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("Home leads with what's due: a short header, the now stack, two tiles", async ({ page }) => {
    await resetMidweek("release_member");
    await signIn(page, "release_member");
    await expect(page.getByRole("heading", { level: 1, name: "This week in KUT" })).toBeVisible();
    const now = page.getByRole("region", { name: "Now" });
    await expect(
      now.getByRole("link", { name: /^Midweek Madness · .*Pick your five/ }),
    ).toBeVisible();
    // The KUT Coins tile went: the coin pill shows the balance.
    await expect(page.getByText("Wallet balance")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Club Value .* See the maths →$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Rank .* Standings →$/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Top risers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "This week’s Chronicle →" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New here? How KUT works →" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await expect(now.getByRole("link", { name: /Pick your five/ })).toBeVisible();
    const tile = await page.getByRole("link", { name: /^Club Value/ }).boundingBox();
    const pack = await page.getByRole("link", { name: "Open a pack" }).boundingBox();
    // From `sm` the two tiles and the pack button share one row.
    expect(Math.abs(tile!.y - pack!.y)).toBeLessThan(2);
    await expectNoHorizontalOverflow(page);
  });

  test("during the evening the live card leads Home, as it stood at page load", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    await withDatabase(async (database) => {
      await startFixtureEvening(database);
    });
    await signIn(page, "release_member");
    const now = page.getByRole("region", { name: "Now" });
    const live = now.getByRole("link").first();
    await expect(live).toContainText("Live");
    await expect(live).toContainText("The draw is out");
    await expect(live).toContainText("See the draw");
    await expect(live).toHaveAttribute("href", "/midweek");
    await expectNoHorizontalOverflow(page);

    await withDatabase(async (database) => {
      // Round 2 kicked off a minute ago: release_member's round-1 match (or bye) is played.
      await advanceFixtureEvening(database, 20);
    });
    await page.reload();
    await expect(live).toContainText("Live");
    await expect(live).toContainText(
      /See the report|Follow the final|Follow the bracket|Watch your match/,
    );
    await expect(live).toHaveAttribute("href", /^\/midweek/);
    await expectNoHorizontalOverflow(page);
  });

  test("every message opens its subject and is marked read on the way", async ({ page }) => {
    const inserted: string[] = [];
    let resultId = "";
    let noticeId = "";
    await withDatabase(async (database) => {
      const member = await database.query<{ id: string }>(
        "select id from kut.profiles where username = 'release_member'",
      );
      const week = await database.query<{ id: string }>(
        "select id from kut.midweek_tournaments where week_start = $1",
        [COMPLETED_WEEK],
      );
      const userId = member.rows[0].id;
      // The completed week may already have messaged its result: reuse it, unread.
      const result = await database.query<{ id: string }>(
        `insert into kut.user_notifications(user_id, event_type, title, body, reference_type, reference_id)
         values ($1, 'midweek_result', 'You went out in round 1', 'E2E result.', 'midweek_tournament', $2)
         on conflict (user_id, event_type, reference_type, reference_id)
           where reference_type is not null and reference_id is not null do nothing
         returning id`,
        [userId, week.rows[0].id],
      );
      if (result.rows[0]) inserted.push(result.rows[0].id);
      resultId = (
        await database.query<{ id: string }>(
          `update kut.user_notifications set read_at = null
           where user_id = $1 and event_type = 'midweek_result' and reference_id = $2 returning id`,
          [userId, week.rows[0].id],
        )
      ).rows[0].id;
      noticeId = (
        await database.query<{ id: string }>(
          `insert into kut.user_notifications(user_id, event_type, title, body)
           values ($1, 'admin_notice', 'E2E club notice', 'Nothing to open.') returning id`,
          [userId],
        )
      ).rows[0].id;
      inserted.push(noticeId);
    });
    try {
      await signIn(page, "release_member");
      await page.goto("/messages");
      await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
      await expect(page.getByText(/^\d+ new · opening one marks it read$/)).toBeVisible();
      const today = page.getByRole("region", { name: "Today" });
      const result = today.locator(`a[href="/messages/${resultId}/open"]`);
      await expect(result).toContainText("New");
      await expect(result).toContainText("Bracket →");
      // A club notice has nowhere to go: no arrow, and opening it only marks it read.
      const notice = today.locator(`a[href="/messages/${noticeId}/open"]`);
      await expect(notice).toContainText("New");
      await expect(notice).not.toContainText("→");
      await expectNoHorizontalOverflow(page);

      await result.click();
      await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}$`));
      await page.goto("/messages");
      await expect(result).not.toContainText("New");
      await expect(result).toContainText("Bracket →");

      await notice.click();
      await expect(page).toHaveURL(/\/messages$/);
      // Read and without a subject, it is no link at all.
      await expect(notice).toHaveCount(0);
      await expect(page.getByText("E2E club notice")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await withDatabase(async (database) => {
        await database.query("delete from kut.user_notifications where id = any($1::uuid[])", [
          inserted,
        ]);
      });
    }
  });
});

test("how-it-works shows the plusses table and the weakest-line rule (ADR-116)", async ({
  page,
}) => {
  await signIn(page, "release_member");
  await page.goto("/how-it-works#midweek");
  await expect(page.getByRole("heading", { name: "Your squad’s shape" })).toBeVisible();
  const plusses = page.getByRole("table").filter({ hasText: "Midfield" });
  await expect(plusses.getByRole("row")).toHaveCount(8);
  await expect(plusses.getByRole("row", { name: /^Tank/ })).toBeVisible();
  await expect(page.getByText("Every line needs at least 3 plusses.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
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

// Last in the file, and only in the last project, so it is the run's last
// test: it spends 175 of the member's 500 coins and adds three cards, which
// the picker tests count.
test("a pack's summary names the slots it fills and the copies it adds (ADR-114)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "authenticated-320", "runs once, last");
  await signIn(page, "release_member");
  await page.goto("/club/packs");
  try {
    await page.getByRole("button", { name: /^Open for \d+ KUT Coins$/ }).click();
    await page.getByRole("button", { name: /^Pay \d+$/ }).click();
    // The first opening on a dev server compiles the reveal page.
    await expect(page).toHaveURL(/\/club\/packs\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Skip all" }).click();
    await expect(page.getByRole("heading", { name: "Your new Live Cards" })).toBeVisible();
    await expect(
      page.getByText(/^(No new Players|\d+ new Players?)\. Album \d+ \/ \d+\.$/),
    ).toBeVisible();
    await expect(
      page.getByText(/^(New · fills slot \d+|×\d+ · discards for \d+)$/).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    // An opening restricts deleting its member, and a card it drew of a
    // fixture Player restricts deleting the fixture: the teardown needs both gone.
    // The member is recreated every run, so its openings are this test's, also
    // when the reveal page never loaded.
    await withDatabase(async (database) => {
      const openings = `select o.id from kut.pack_openings o join auth.users u on u.id = o.user_id
        where u.email = 'release_member@users.kut.local'`;
      const cards = await database.query<{ card_id: string }>(
        `delete from kut.pack_opening_cards where opening_id in (${openings}) returning card_id`,
      );
      await database.query(`delete from kut.pack_openings where id in (${openings})`);
      await database.query("delete from kut.user_cards where id = any($1::uuid[])", [
        cards.rows.map((row) => row.card_id),
      ]);
    });
  }
});
