import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RatingHistory, buildGoalsByWeek, ratingDomain } from "@/components/rating-history";

describe("rating chart tier domain", () => {
  it("adds one rarity band around a Gold series", () => {
    expect(ratingDomain([61, 67, 69]).map((band) => band.tier)).toEqual(["silver", "gold", "holo"]);
  });

  it("does not render a tier below Common at the engine floor", () => {
    expect(ratingDomain([30]).map((band) => band.tier)).toEqual(["common", "bronze"]);
  });
});

describe("goals per football week", () => {
  // Freek's graph (KB-021): the 31 Aug week is pre-cutover and admin-entered,
  // every September week is reported. Only the first rendered a football.
  const attendance = [
    { goals: 10, session_date: "2026-09-04", rating_rules_version: 1 },
    { goals: 0, session_date: "2026-09-11", rating_rules_version: 2 },
  ];
  const contributions = [
    { session_date: "2026-09-21", effective_goals: 3 },
    { session_date: "2026-09-14", effective_goals: 1 },
    { session_date: "2026-09-11", effective_goals: 2 },
  ];

  it("reads reported goals for post-cutover weeks", () => {
    const goals = buildGoalsByWeek(attendance, contributions);
    expect(goals.get("2026-09-21")).toBe(3);
    expect(goals.get("2026-09-14")).toBe(1);
    expect(goals.get("2026-09-07")).toBe(2);
  });

  it("still reads attendance goals for pre-cutover weeks", () => {
    expect(buildGoalsByWeek(attendance, contributions).get("2026-08-31")).toBe(10);
  });

  it("never counts a v2 session from both sources", () => {
    const doubled = [{ goals: 2, session_date: "2026-09-11", rating_rules_version: 2 }];
    expect(buildGoalsByWeek(doubled, contributions).get("2026-09-07")).toBe(2);
  });

  it("sums several sessions in one week", () => {
    const twice = [
      { session_date: "2026-09-14", effective_goals: 1 },
      { session_date: "2026-09-17", effective_goals: 2 },
    ];
    expect(buildGoalsByWeek([], twice).get("2026-09-14")).toBe(3);
  });

  it("leaves a goalless week out of the map entirely", () => {
    const none = [{ session_date: "2026-09-14", effective_goals: null }];
    expect(buildGoalsByWeek([], none).has("2026-09-14")).toBe(false);
  });
});

// ADR-101: a week from 28 Sep 2026 counts goals + assists; earlier weeks keep goals.
describe("rating history labels", () => {
  const snapshots = [
    { week_start: "2026-09-21", live_ovr: 48 },
    { week_start: "2026-09-28", live_ovr: 51 },
  ];
  const goalsByWeek = new Map([
    ["2026-09-21", 2],
    ["2026-09-28", 4],
  ]);
  const html = renderToStaticMarkup(
    createElement(RatingHistory, { snapshots, goalsByWeek, playerName: "GA A" }),
  );

  it("tooltips each week in its own terms", () => {
    // en-GB short months are "Sep" or "Sept" depending on the ICU build.
    expect(html).toMatch(/<title>21 Sept?: 48 OVR, 2 goals<\/title>/);
    expect(html).toMatch(/<title>28 Sept?: 51 OVR, 4 G\+A<\/title>/);
  });

  it("spells G+A out in the football's accessible label", () => {
    expect(html).toContain('aria-label="2 goals in this week"');
    expect(html).toContain('aria-label="4 goals and assists in this week"');
  });

  it("heads a mixed table for both and labels every row", () => {
    expect(html).toContain("<th>Goals / G+A</th>");
    expect(html).toContain("<td>2 goals</td>");
    expect(html).toContain("<td>4 G+A</td>");
  });

  it("keeps a wholly historical table in goals", () => {
    const historical = renderToStaticMarkup(
      createElement(RatingHistory, {
        snapshots: [{ week_start: "2026-09-14", live_ovr: 46 }],
        goalsByWeek: new Map([["2026-09-14", 1]]),
        playerName: "GA A",
      }),
    );
    expect(historical).toContain("<th>Goals</th>");
    expect(historical).toContain("<td>1 goal</td>");
    expect(historical).not.toContain("G+A");
  });
});
