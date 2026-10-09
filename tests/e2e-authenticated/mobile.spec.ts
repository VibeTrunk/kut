import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { BRAND } from "../../src/lib/brand";
import { assertLocalTarget } from "../support/local-target";
import {
  advanceFixtureEvening,
  COMPLETED_WEEK,
  endFixtureEvening,
  FIXTURE_PHOTO,
  resetMidweekMember,
  setWeekArchetype,
  startFixtureEvening,
} from "./midweek-fixture";

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
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

/**
 * The deeper team colours (ADR-119): violet names on the left, teal on the
 * right, and both fills as a 3 px strip across the top of the scoreboard.
 */
async function expectTeamColours(page: Page) {
  const board = page.getByRole("group", { name: /^Final score:/ });
  const seen = await board.evaluate((el) => {
    const colour = (selector: string, property: "color" | "backgroundColor") => {
      const node = el.querySelector(selector);
      return node ? getComputedStyle(node)[property] : null;
    };
    const strip = el.querySelector(".bg-team-0-fill")?.parentElement?.getBoundingClientRect();
    return {
      names: [colour(".text-team-0", "color"), colour(".text-team-1", "color")],
      fills: [
        colour(".bg-team-0-fill", "backgroundColor"),
        colour(".bg-team-1-fill", "backgroundColor"),
      ],
      strip: strip && {
        height: strip.height,
        width: strip.width,
        top: strip.top - el.getBoundingClientRect().top,
      },
      board: el.getBoundingClientRect().width,
    };
  });
  expect(seen.names).toEqual(["rgb(158, 128, 209)", "rgb(79, 179, 160)"]);
  expect(seen.fills).toEqual(["rgb(111, 79, 161)", "rgb(31, 122, 108)"]);
  expect(seen.strip?.height).toBe(3);
  expect(seen.strip?.top).toBeLessThanOrEqual(1);
  expect(seen.strip?.width).toBeGreaterThan(seen.board - 4);
}

/**
 * The ratings block (F7, ADR-117): five night ratings in neutral discs, one
 * best chip, `Show each match` opening a chip per match, all inside the screen.
 */
async function expectRatings(page: Page, { open }: { open: boolean }) {
  const block = page.getByRole("region", { name: "Your five’s ratings" });
  await expect(block).toBeVisible();
  await expect(block.getByText(/^Out of 10, the mean of \d+ match(es)?$/)).toBeVisible();
  await expect(
    block.getByText(/^rated \d+\.\d out of 10 for the night$/).filter({ visible: true }),
  ).toHaveCount(5);
  await expect(block.getByText("★ Best of your five").filter({ visible: true })).toHaveCount(1);
  const chips = block.getByRole("link", { name: / v .+ rated \d+\.\d out of 10 against / });
  const toggle = block.getByRole("button", { name: /^(Show|Hide) each match$/ });
  await expect(toggle).toHaveAttribute("aria-expanded", String(open));
  if (!open) {
    await expect(chips.filter({ visible: true })).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAccessibleName("Hide each match");
  }
  expect(await chips.filter({ visible: true }).count()).toBeGreaterThanOrEqual(5);
  await expect(block.getByRole("link", { name: "How ratings work →" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
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

test("member can sign in and use core mobile routes", { tag: "@narrow" }, async ({ page }) => {
  await signIn(page, "release_member");
  expect(1, "S2 deliberate red check; revert before merge").toBe(2);
  await expect(page.getByRole("heading", { name: `This week in ${BRAND.shortName}` })).toBeVisible({
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

  test(
    "the picker filters by archetype, keeps Save in reach, and names a coming archetype (KB-028/029)",
    { tag: "@narrow" },
    async ({ page }) => {
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
      await expect(
        page.getByText("Speedster from next week").filter({ visible: true }),
      ).toHaveCount(1);
      await page.getByRole("button", { name: /: Winger Fixture$/ }).click();
      await expect(
        page.getByText("Goalkeeper this week, Speedster from next").filter({ visible: true }),
      ).toHaveCount(1);
      await expect(
        page.getByText("Speedster from next week").filter({ visible: true }),
      ).toHaveCount(2);
      await expectNoHorizontalOverflow(page);
    },
  );

  test("the plusses count follows the five: no count without a Goalkeeper, a short line and its factor, then balanced", async ({
    page,
  }) => {
    const add = (name: string) =>
      page.getByRole("button", { name: new RegExp(`${PICK_BUTTON.source}${name}`) }).click();
    await signIn(page, "release_member");
    await page.goto("/midweek");
    // Each phone row shows its card's plusses, from the engine's table.
    await expect(
      page.getByText("Plusses: attack 3, midfield 1, defence 0").filter({ visible: true }),
    ).toHaveCount(1);

    const lines = page.getByRole("region", { name: "Plusses per line" });
    for (const name of ["Striker Fixture", "Winger Fixture", "Engine Fixture"]) await add(name);
    await expect(lines.getByText(/^Add a Goalkeeper to see your count\./)).toBeVisible();
    await expect(page.getByText("No Goalkeeper yet, so no line count")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // With the Goalkeeper in goal, the empty slot plays as a trialist (1/1/1).
    await add("Keeper Fixture");
    await expect(lines.getByRole("group")).toHaveAccessibleName(
      "Attack 7 of 3, enough; Midfield 7 of 3, enough; Defence 1 of 3, 2 short",
    );
    await expect(
      lines.getByText("2 plusses short, so your whole five plays at ×0.77 this week."),
    ).toBeVisible();
    await expect(lines.getByText("Keeper Fixture goes in goal and isn’t counted.")).toBeVisible();
    await expect(page.getByText("! Defence 2 short · ×0.77")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await add("Wall Fixture");
    await expect(lines.getByText("Every line has 3 or more, so no penalty.")).toBeVisible();
    await expect(page.getByText("✓ Lines balanced")).toBeVisible();
    await expect(lines.getByRole("link", { name: "How plusses work →" })).toHaveAttribute(
      "href",
      "/how-it-works#midweek-shape",
    );

    // From sm the save bar is inline and its second row is hidden; the count stays.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText("✓ Lines balanced")).toBeHidden();
    await expect(lines).toBeVisible();
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
  test(
    "a completed week's bracket and a match report fit the screen",
    { tag: "@narrow" },
    async ({ page }, testInfo) => {
      test.fixme(
        process.platform === "linux" && testInfo.project.name === "authenticated-pixel7",
        "KB-042 (#216): the focused Form factor shows no tooltip on Linux at Pixel 7 size",
      );
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
      await expectTeamColours(page);

      await expectMatchPageWhy(page);
    },
  );

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
    await expectTeamColours(page);
    await expectMatchPageWhy(page);
  });

  test("the complete bracket leads with your ratings, and each chip opens its rated report", async ({
    page,
  }) => {
    await signIn(page, "release_member");
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await expect(page.getByRole("navigation", { name: "Jump to" })).toContainText("Your ratings");
    await expectRatings(page, { open: true });

    const block = page.getByRole("region", { name: "Your five’s ratings" });
    const chip = block
      .getByRole("link", { name: / rated \d+\.\d out of 10 against / })
      .filter({ visible: true })
      .first();
    const shown = (await chip.innerText()).match(/\d+\.\d/)![0];
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${COMPLETED_WEEK}/match/[0-9a-f-]{36}$`));
    // The Why list adds a rating per card for this match, the chip's number among them.
    await expect(page.getByText(/^rated \d+\.\d out of 10 for this match$/)).toHaveCount(10);
    await expect(page.getByText(`rated ${shown} out of 10 for this match`).first()).toBeAttached();
    await expect(page.getByText("Rating: how it played, out of 10")).toBeVisible();
    await expect(page.getByText(/The circle on the right is how the card played/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/how-it-works#midweek-ratings");
    await expect(page.getByRole("heading", { name: "Ratings", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("on a 1440 px desktop the ratings show the five cards in a row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "release_member");
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await expectRatings(page, { open: true });
    const block = page.getByRole("region", { name: "Your five’s ratings" });
    const discs = block
      .getByText(/^rated \d+\.\d out of 10 for the night$/)
      .filter({ visible: true });
    const tops = await discs.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.parentElement!.getBoundingClientRect().top)),
    );
    // One row of five: the discs line up, give or take the best chip's extra line.
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(12);
    await page
      .getByRole("link", { name: /^Match report: / })
      .first()
      .click();
    await expect(page.getByText(/^rated \d+\.\d out of 10 for this match$/)).toHaveCount(10);
    await expectNoHorizontalOverflow(page);
  });

  test("from lg, every bracket line meets the match it leads to (KB-031)", async ({ page }) => {
    test.fixme(
      process.platform === "linux",
      "KB-042 (#216): a round-1 pairing sits off its quarter point with Linux text metrics",
    );
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

  test(
    "from the lock: the draw, every five, kick-off times and the bracket",
    { tag: "@narrow" },
    async ({ page }) => {
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
      await expect(
        page.getByText(/^Form, pick boost and the chances before kick-off/),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: /^(Round 1|Quarter-finals|Semi-finals)$/ }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("group", { name: /, kick-off \d\d:\d\d\.$|has a bye, which counts/ })
          .first(),
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
    },
  );

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

  test("after the final: the champion, your ratings and the way to past weeks", async ({
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
    // The ratings replace their placeholder (F7, ADR-117), closed by default here.
    await expect(page.getByRole("note").filter({ hasText: "Your five’s ratings" })).toHaveCount(0);
    await expectRatings(page, { open: false });
    await expect(page.getByRole("region", { name: "Share the night" })).toBeVisible();
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
    // Live has its own tint now, never a side's (ADR-119).
    await expect(home).toHaveCSS("border-top-color", "rgb(122, 45, 59)");
    await expect(home).toHaveCSS("background-image", /linear-gradient/);
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

test.describe("Midweek Madness calls (D, ADR-118)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test("once out, a member calls the later matches, sees them on the bracket, and is paid for the right ones", async ({
    page,
  }) => {
    await resetMidweek("release_member");
    let weekStart = "";
    let rounds = 0;
    let out = null as { login: string; round: number } | null;
    await withDatabase(async (database) => {
      ({ weekStart, rounds } = await startFixtureEvening(database));
      // Whoever goes out first before the final, a release account if one does.
      // The field is the local stack's, so it can be a fixture member: then it
      // gets the release password for this test (local rows the teardown deletes).
      const lost = await database.query<{ id: string; username: string | null; round: number }>(
        `select p.id, p.username, min(m.round)::int as round from kut.midweek_matches m
         join kut.midweek_tournaments t on t.id = m.tournament_id
         join kut.profiles p on p.id in (m.side_0_user_id, m.side_1_user_id)
         where t.week_start = $1 and not m.bye and m.winner_user_id <> p.id
           and (p.username in ('release_member', 'release_admin') or p.id::text like '00000097-%')
         group by p.id, p.username
         having min(m.round) < $2
         order by (p.username is null), 3, p.username
         limit 1`,
        [weekStart, rounds],
      );
      const row = lost.rows[0];
      if (!row) return;
      if (!row.username) {
        const email = await database.query<{ email: string }>(
          `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             instance_id = '00000000-0000-0000-0000-000000000000',
             confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = ''
           where id = $1 returning email`,
          [row.id, "fictional-release-password"],
        );
        out = { login: email.rows[0].email, round: row.round };
      } else out = { login: row.username, round: row.round };
      // A minute before the next round kicks off: every match before it has ended.
      await advanceFixtureEvening(database, 3 + 15 * row.round);
    });
    test.skip(!out, "Nobody in the fixture goes out before the final.");
    await page.goto("/login");
    await page.getByLabel("Username").fill(out!.login);
    await page.getByLabel("Password").fill("fictional-release-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/midweek");
    const block = page.getByRole("region", { name: "Call the winners" });
    await expect(block).toBeVisible();
    await expect(
      block.getByText(
        new RegExp(`^\\+\\d+ ${BRAND.currency} a correct pick · paid after the final$`),
      ),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // A tap saves at once; the other name changes it; tapping the pick again clears it.
    const card = block
      .getByRole("group", { name: /, kick-off \d\d:\d\d\. Who wins\?$/ })
      .filter({ has: page.getByRole("button", { disabled: false }) })
      .first();
    const [first, second] = [card.getByRole("button").nth(0), card.getByRole("button").nth(1)];
    const firstName = (await first.innerText())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)[0];
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText(/^✓ Saved \d\d:\d\d\.$/)).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText(/^✓ Changed to .+, \d\d:\d\d\.$/)).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(card.getByText(/^Pick cleared\./)).toBeVisible();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);

    // Saved for real: a reload shows the pick.
    await page.reload();
    const saved = page
      .getByRole("region", { name: /^(Call the winners|Your calls)$/ })
      .getByRole("button", { name: new RegExp(`^${firstName}`) })
      .first();
    await expect(saved).toHaveAttribute("aria-pressed", "true");

    // The bracket shows the call and never takes one.
    await page.goto(`/midweek/${weekStart}`);
    await expect(
      page.getByText(`✓ Your call: ${firstName}`).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${firstName}`) })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/midweek");
    await expect(page.getByRole("region", { name: "Call the winners" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/midweek/${weekStart}`);
    await expect(
      page.getByText(`✓ Your call: ${firstName}`).filter({ visible: true }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Kick-off: the call closes and the club's split shows (counts only).
    await withDatabase((database) => advanceFixtureEvening(database, 2));
    await page.goto("/midweek");
    await expect(page.getByText(`Closed at kick-off. You picked ${firstName}.`)).toBeVisible();
    await expect(page.getByText("How the club called it").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // After the final the week is paid: the weekly line, and the calls kept on the bracket.
    await withDatabase((database) => advanceFixtureEvening(database, 120, { runWorker: true }));
    await page.goto("/midweek");
    await expect(page.getByText(/^You called [01] of 1 right/)).toBeVisible();
    await expect(page.getByText(/ for wins, \d+ for calls$/)).toBeVisible();
    await page.getByRole("link", { name: "Your calls →" }).click();
    await expect(page).toHaveURL(new RegExp(`/midweek/${weekStart}#calls$`));
    await expect(page.getByRole("region", { name: "Your calls" })).toContainText(
      `You picked ${firstName}.`,
    );
    await expectNoHorizontalOverflow(page);

    await page.goto("/how-it-works#midweek-calls");
    await expect(page.getByRole("heading", { name: "Calls, once you’re out" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Midweek Madness share images (F8, ADR-120)", () => {
  // One fixture Player of the champion's five gets a real local photo, so the
  // canvas draws a photo fetched from Storage; a tainted canvas couldn't export.
  test.beforeEach(async () => {
    await withDatabase(async (database) => {
      await database.query(
        "update kut.players set photo_path = $1 where display_name = 'Engine Fixture'",
        [FIXTURE_PHOTO],
      );
    });
  });
  test.afterEach(async () => {
    await withDatabase(async (database) => {
      await database.query(
        "update kut.players set photo_path = null where display_name = 'Engine Fixture'",
      );
    });
  });

  /** A PNG's width and height, from its IHDR chunk. */
  const pngSize = (bytes: Buffer) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

  test(
    "on a phone, both images draw at 1080 × 1350 and Share hands the PNG to the share sheet",
    { tag: "@narrow" },
    async ({ page }) => {
      await page.addInitScript(() => {
        const record = window as unknown as { __shared?: string[] };
        record.__shared = [];
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", {
          value: async (data: { files: File[] }) => {
            record.__shared!.push(
              `${data.files[0].name} ${data.files[0].type} ${data.files[0].size}`,
            );
          },
          configurable: true,
        });
      });
      await signIn(page, "release_member");
      await page.goto(`/midweek/${COMPLETED_WEEK}`);
      const block = page.getByRole("region", { name: "Share the night" });
      await expect(block).toBeVisible();
      for (const name of ["Preview: The champion poster", "Preview: Your night"]) {
        const preview = block.getByRole("img", { name });
        await expect(preview).toBeVisible({ timeout: 15_000 });
        expect(
          await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
        ).toEqual([1080, 1350]);
      }
      await expect(block.getByText(/^Both show managers’ and Players’ names/)).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await block.getByRole("button", { name: "Share" }).first().click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __shared: string[] }).__shared))
        .toEqual([expect.stringMatching(/^flut-midweek-17-jan-champion\.png image\/png \d+$/)]);

      const download = page.waitForEvent("download");
      await block.getByRole("button", { name: "Save image" }).nth(1).click();
      expect((await download).suggestedFilename()).toBe("flut-midweek-17-jan-release-member.png");
      await expect(
        block.getByText(/is in your downloads\. Drop it into the group chat\.$/),
      ).toBeVisible();
    },
  );

  test("on a desktop, Download saves the PNG", async ({ browser }) => {
    // Playwright passes the project's phone options on; a desktop has a mouse.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();
    try {
      await signIn(page, "release_member");
      await page.goto(`/midweek/${COMPLETED_WEEK}`);
      const block = page.getByRole("region", { name: "Share the night" });
      await expect(block.getByRole("img", { name: "Preview: The champion poster" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(block.getByRole("button", { name: "Share" })).toHaveCount(0);
      const download = page.waitForEvent("download");
      await block.getByRole("button", { name: "Download" }).first().click();
      const saved = await download;
      expect(saved.suggestedFilename()).toBe("flut-midweek-17-jan-champion.png");
      const bytes = readFileSync(await saved.path());
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(pngSize(bytes)).toEqual([1080, 1350]);
      await expect(block.getByRole("button", { name: "Downloaded" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});

test.describe("Home and Messages (F4, ADR-114)", () => {
  test.afterEach(async () => {
    await withDatabase(endFixtureEvening);
  });

  test(
    "Home leads with what's due: a short header, the now stack, two tiles",
    { tag: "@narrow" },
    async ({ page }) => {
      await resetMidweek("release_member");
      await signIn(page, "release_member");
      await expect(
        page.getByRole("heading", { level: 1, name: `This week in ${BRAND.shortName}` }),
      ).toBeVisible();
      const now = page.getByRole("region", { name: "Now" });
      await expect(
        now.getByRole("link", { name: /^Midweek Madness · .*Pick your five/ }),
      ).toBeVisible();
      // The coins tile went: the coin pill shows the balance.
      await expect(page.getByText("Wallet balance")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /^Club Value .* See the maths →$/ }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^Rank .* Standings →$/ })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Top risers" })).toBeVisible();
      await expect(page.getByRole("link", { name: "This week’s Chronicle →" })).toBeVisible();
      await expect(
        page.getByRole("link", { name: `New here? How ${BRAND.shortName} works →` }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.reload();
      await expect(now.getByRole("link", { name: /Pick your five/ })).toBeVisible();
      const tile = await page.getByRole("link", { name: /^Club Value/ }).boundingBox();
      const pack = await page.getByRole("link", { name: "Open a pack" }).boundingBox();
      // From `sm` the two tiles and the pack button share one row.
      expect(Math.abs(tile!.y - pack!.y)).toBeLessThan(2);
      await expectNoHorizontalOverflow(page);
    },
  );

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

test(
  "admin can reach the mobile attendance finalization surface",
  { tag: "@narrow" },
  async ({ page }) => {
    await signIn(page, "release_admin");
    await page.goto("/admin/attendance");
    await expect(page.getByRole("heading", { name: "Record attendance" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  },
);

// Last in this file and run once on the narrow Chromium project. It spends
// 250 coins and adds cards; finally removes those cards so the later WebKit
// project keeps the same picker inventory.
test(
  "a pack's summary names the slots it fills and the copies it adds (ADR-114)",
  { tag: "@narrow" },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "authenticated-320", "runs once on narrow Chromium");
    await signIn(page, "release_member");
    await page.goto("/club/packs");
    try {
      await page
        .getByRole("button", { name: new RegExp(`^Open for \\d+ ${BRAND.currency}$`) })
        .click();
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
  },
);
