import { describe, expect, it } from "vitest";
import { describeFoldedActivity, foldActivity, type ActivityRow } from "@/lib/activity";
import { checkInClosesAt, orderNowCards } from "@/lib/home/now";
import {
  groupMessages,
  messageTarget,
  targetLookupIds,
  type TargetLookups,
  type UserNotification,
} from "@/lib/messages";
import { packSummary } from "@/lib/pack-summary";

describe("Home's now stack (ADR-114)", () => {
  it("leads with the evening, then the soonest deadline, then cards without one", () => {
    const order = orderNowCards([
      { key: "report", deadline: 300, value: null },
      { key: "none", deadline: null, value: null },
      { key: "pick", deadline: 100, value: null },
      { key: "evening", leads: true, deadline: null, value: null },
      { key: "check-in", deadline: 200, value: null },
    ]).map((card) => card.key);
    expect(order).toEqual(["evening", "pick", "check-in", "report", "none"]);
  });

  it("keeps the given order on a tie", () => {
    const order = orderNowCards([
      { key: "a", deadline: 5, value: null },
      { key: "b", deadline: 5, value: null },
    ]).map((card) => card.key);
    expect(order).toEqual(["a", "b"]);
  });

  it("closes a rehab check-in at the end of the following week", () => {
    expect(new Date(checkInClosesAt("2026-09-28")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});

describe("Club activity folds a member's pack openings (ADR-114)", () => {
  const row = (kind: ActivityRow["kind"], actor: string | null, ts: string): ActivityRow => ({
    kind,
    ts,
    actor_name: actor,
    counterparty_name: null,
    card_name: null,
    amount: 100,
    session_date: null,
    session_type: null,
    offered_card_names: null,
  });

  it("folds consecutive openings by one member and stops at the limit", () => {
    const rows = [
      row("pack", "Member B", "t9"),
      row("pack", "Member B", "t8"),
      row("pack", "Member B", "t7"),
      row("pack", "Sophie D.", "t6"),
      row("listing", "Sophie D.", "t5"),
      row("pack", "Member B", "t4"),
      row("pack", null, "t3"),
      row("pack", null, "t2"),
    ];
    const folded = foldActivity(rows, 6);
    expect(folded.map((r) => [r.actor_name, r.packs, r.ts])).toEqual([
      ["Member B", 3, "t9"],
      ["Sophie D.", 1, "t6"],
      ["Sophie D.", 1, "t5"],
      ["Member B", 1, "t4"],
      // Unnamed rows never fold: "A member" may be two people.
      [null, 1, "t3"],
      [null, 1, "t2"],
    ]);
    expect(describeFoldedActivity(folded[0])).toBe("Member B opened 3 packs.");
    expect(describeFoldedActivity(folded[1])).toBe("Sophie D. opened a pack (100 KUT Coins).");
    expect(foldActivity(rows, 2)).toHaveLength(2);
  });
});

describe("the inbox (ADR-114)", () => {
  const message = (
    event_type: UserNotification["event_type"],
    reference_type: string | null = null,
    reference_id: string | null = null,
    created_at = "2026-10-02T19:09:00Z",
  ): UserNotification => ({
    id: `${event_type}-${created_at}`,
    event_type,
    title: "Title",
    body: "Body",
    reference_type,
    reference_id,
    read_at: null,
    created_at,
  });
  const lookups: TargetLookups = {
    weekByTournament: new Map([["t1", "2026-09-28"]]),
    ownedCardBySale: new Map([["s1", "c1"]]),
  };
  const target = (m: UserNotification) => messageTarget(m, lookups);

  it("links every message to its subject, by type", () => {
    expect(target(message("midweek_result", "midweek_tournament", "t1"))).toEqual({
      href: "/midweek/2026-09-28",
      label: "Bracket",
    });
    expect(target(message("market_sale", "market_sale", "s9"))).toEqual({
      href: "/club/value",
      label: "Wallet",
    });
    expect(target(message("market_purchase", "market_sale", "s1"))).toEqual({
      href: "/club/collection/c1",
      label: "Your card",
    });
    expect(target(message("trade_offer", "trade_offer", "o1"))?.href).toBe("/market/offers");
    expect(target(message("trade_response", "trade_offer", "o1"))?.label).toBe("Offers");
    expect(target(message("kudos_awarded", "match_session", "m1"))).toEqual({
      href: "/settings/card",
      label: "Your card",
    });
    for (const type of [
      "session_results",
      "attendance_reward",
      "bibs_bonus",
      "report_correction",
    ] as const) {
      expect(target(message(type, "match_session", "m1"))).toEqual({
        href: "/sessions/m1",
        label: "Chronicle",
      });
    }
    expect(target(message("session_report", "match_session", "m1"))).toEqual({
      href: "/sessions/m1/report",
      label: "Your report",
    });
    expect(target(message("injury_check_in", "match_session", "m1"))?.href).toBe("/");
  });

  it("leaves a message without a subject unlinked", () => {
    expect(target(message("admin_notice", "wallet_adjustment", "x"))).toBeNull();
    expect(target(message("pack_opened"))).toBeNull();
    // A week it can't place, or a bought card sold on since.
    expect(target(message("midweek_result", "midweek_tournament", "t9"))).toBeNull();
    expect(target(message("market_purchase", "market_sale", "s2"))).toBeNull();
    expect(target(message("session_results"))).toBeNull();
  });

  it("asks only for the ids it must look up", () => {
    expect(
      targetLookupIds([
        message("midweek_result", "midweek_tournament", "t1"),
        message("midweek_result", "midweek_tournament", "t1", "2026-10-01T10:00:00Z"),
        message("market_purchase", "market_sale", "s1"),
        message("market_sale", "market_sale", "s2"),
      ]),
    ).toEqual({ tournamentIds: ["t1"], saleIds: ["s1"] });
  });

  it("groups by day in club time: today, earlier this week, then each older day", () => {
    // Friday 2 Oct 2026, 21:30 in Amsterdam.
    const now = new Date("2026-10-02T19:30:00Z");
    const groups = groupMessages(
      [
        message("market_sale", null, null, "2026-10-02T19:09:00Z"),
        // 00:30 on Friday in Amsterdam, still Thursday in UTC.
        message("market_sale", null, null, "2026-10-01T22:30:00Z"),
        message("trade_offer", null, null, "2026-09-28T08:00:00Z"),
        message("kudos_awarded", null, null, "2026-09-27T20:00:00Z"),
        message("kudos_awarded", null, null, "2026-09-27T09:00:00Z"),
      ],
      now,
    );
    expect(groups.map((g) => [g.heading, g.messages.map((m) => m.time)])).toEqual([
      ["Today", ["21:09", "00:30"]],
      ["Earlier this week", ["Mon"]],
      ["Sun 27 Sept", ["22:00", "11:00"]],
    ]);
  });
});

describe("the pack summary's chips (ADR-114)", () => {
  const roster = ["p1", "p2", "p3", "p4"];

  it("names the slot a new Player fills, and the copies of one already held", () => {
    const summary = packSummary({
      opened: [
        { card_id: "c1", player_id: "p2" },
        { card_id: "c2", player_id: "p3" },
        { card_id: "c3", player_id: "p2" },
      ],
      owned: [
        { card_id: "c1", player_id: "p2", discard_value: 20 },
        { card_id: "c2", player_id: "p3", discard_value: 31 },
        { card_id: "c3", player_id: "p2", discard_value: 22 },
        { card_id: "old", player_id: "p3", discard_value: 30 },
        { card_id: "c9", player_id: "p1", discard_value: 10 },
      ],
      roster,
    });
    expect(summary.chips).toEqual([
      { kind: "new", slot: 2, text: "New · fills slot 2" },
      { kind: "copies", copies: 2, text: "×2 · discards for 31" },
      { kind: "copies", copies: 2, text: "×2 · discards for 22" },
    ]);
    expect(summary.line).toBe("1 new Player. Album 3 / 4.");
  });

  it("says nothing on a single copy already held or a card gone since", () => {
    const summary = packSummary({
      opened: [
        { card_id: "c1", player_id: "p1" },
        { card_id: "gone", player_id: "p4" },
        { card_id: "c3", player_id: null },
      ],
      owned: [{ card_id: "c1", player_id: "p1", discard_value: 10 }],
      roster,
    });
    // p1's only copy came from this pack, so it is new; the others say nothing.
    expect(summary.chips).toEqual([
      { kind: "new", slot: 1, text: "New · fills slot 1" },
      null,
      null,
    ]);
    expect(
      packSummary({
        opened: [{ card_id: "c2", player_id: "p1" }],
        owned: [
          { card_id: "c1", player_id: "p9", discard_value: 1 },
          { card_id: "c2", player_id: "p1", discard_value: 1 },
          { card_id: "c0", player_id: "p1", discard_value: 1 },
        ],
        roster,
      }).line,
    ).toBe("No new Players. Album 1 / 4.");
  });
});
