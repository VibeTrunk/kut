import { describe, expect, it } from "vitest";
import { MIDWEEK } from "@/game/midweek/config";
import { ovrFactorPpm } from "@/game/midweek/power";
import { copyStrengthPpm, strongestCopies } from "@/lib/midweek/copies";
import {
  LOCK_CLOCK,
  ROUND_ONE_CLOCK,
  countdownText,
  formatDayDate,
  formatSavedAt,
  formatShortLock,
  isLockedTonight,
  isMidweekVisible,
  isPickingOpen,
  joinNames,
  keeperCheck,
  lastWeekSummary,
  nextEntryWeekLabel,
  optOutConfirmText,
  prefillNotice,
  prefillSlots,
  saveStatus,
  skipOrVoidText,
  squadSaveError,
  stageName,
  starterNotice,
  weekArchetype,
  type MidweekCurrent,
} from "@/lib/midweek/entry";

const text = (segments: { text: string }[]) => segments.map((segment) => segment.text).join("");

function current(overrides: Partial<MidweekCurrent> = {}): MidweekCurrent {
  return {
    enabled: true,
    tournament_id: "t1",
    week_start: "2026-10-05",
    // Wed 7 Oct 2026, 20:00 CEST.
    lock_at: "2026-10-07T18:00:00Z",
    seed_hash: "a".repeat(64),
    status: "open",
    status_reason: null,
    void_note: null,
    rounds: null,
    final_reveal_at: null,
    seed: null,
    opted_out: false,
    ...overrides,
  };
}

describe("club time", () => {
  it("formats the lock in Europe/Amsterdam on either side of the October change", () => {
    expect(formatDayDate("2026-10-07T18:00:00Z")).toBe("Wed 7 Oct");
    expect(formatShortLock("2026-10-07T18:00:00Z")).toBe("Wed 20:00");
    // After the last Sunday of October Amsterdam is UTC+1.
    expect(formatShortLock("2026-11-04T19:00:00Z")).toBe("Wed 20:00");
    expect(formatSavedAt("2026-10-06T12:02:00Z")).toBe("Tue 6 Oct, 14:02");
  });

  it("derives the lock and round-1 clocks from the engine's schedule", () => {
    expect(LOCK_CLOCK).toBe("20:00");
    expect(ROUND_ONE_CLOCK).toBe("20:30");
    expect(MIDWEEK.schedule.lockHourLocal).toBe(20);
  });
});

describe("countdownText", () => {
  const lock = new Date("2026-10-07T18:00:00Z");
  const before = (ms: number) => new Date(lock.getTime() - ms);
  const minute = 60_000;
  const hour = 60 * minute;

  it("reads in days and hours from a day out", () => {
    expect(countdownText(lock, before(28 * hour))).toBe("in 1 day, 4 h");
    expect(countdownText(lock, before(48 * hour))).toBe("in 2 days");
  });

  it("reads in hours and minutes below a day", () => {
    expect(countdownText(lock, before(5 * hour + 12 * minute))).toBe("in 5 h, 12 min");
    expect(countdownText(lock, before(3 * hour))).toBe("in 3 h");
  });

  it("reads in minutes below an hour, rounding up so it never says 0", () => {
    expect(countdownText(lock, before(18 * minute))).toBe("in 18 min");
    expect(countdownText(lock, before(10_000))).toBe("in 1 min");
    expect(countdownText(lock, lock)).toBe("now");
  });
});

describe("visibility (ADR-097, HANDOFF open question 6)", () => {
  it("shows with the switch on, or while a week still runs after a pause", () => {
    expect(isMidweekVisible(current())).toBe(true);
    expect(isMidweekVisible(current({ enabled: false, status: "open" }))).toBe(true);
    expect(isMidweekVisible(current({ enabled: false, status: "simulated" }))).toBe(true);
    expect(isMidweekVisible(current({ enabled: true, tournament_id: null, status: null }))).toBe(
      true,
    );
  });

  it("hides once a paused week has finished, and on a failed or denied read", () => {
    expect(isMidweekVisible(current({ enabled: false, status: "complete" }))).toBe(false);
    expect(isMidweekVisible(current({ enabled: false, status: "void" }))).toBe(false);
    expect(isMidweekVisible(current({ enabled: false, status: null }))).toBe(false);
    expect(isMidweekVisible(null)).toBe(false);
  });

  it("opens picking only before the lock of an open week", () => {
    const before = new Date("2026-10-07T17:59:00Z");
    const after = new Date("2026-10-07T18:00:00Z");
    expect(isPickingOpen(current(), before)).toBe(true);
    expect(isPickingOpen(current(), after)).toBe(false);
    expect(isLockedTonight(current(), after)).toBe(true);
    expect(isLockedTonight(current({ status: "simulated" }), before)).toBe(true);
    expect(isLockedTonight(current({ status: "complete" }), after)).toBe(false);
  });
});

describe("weekArchetype", () => {
  const frozen = new Map([["p1", "goalkeeper"]]);

  it("plays the snapshot from the open, and names a change since", () => {
    expect(weekArchetype(frozen, "p1", "speedster")).toEqual({
      archetype: "goalkeeper",
      label: "Goalkeeper this week, Speedster from next",
    });
  });

  it("names an unchanged archetype plainly", () => {
    expect(weekArchetype(frozen, "p1", "goalkeeper")).toEqual({
      archetype: "goalkeeper",
      label: "Goalkeeper",
    });
  });

  it("falls back to the live archetype for a Player without a snapshot", () => {
    expect(weekArchetype(frozen, "p2", "tank")).toEqual({ archetype: "tank", label: "Tank" });
    expect(weekArchetype(new Map(), "p1", "all_rounder").archetype).toBe("all_rounder");
  });
});

describe("keeperCheck", () => {
  const card = (archetype: string, displayName = "X") => ({ archetype, displayName });

  it("names the one Goalkeeper", () => {
    const check = keeperCheck([card("goalkeeper", "Yara Q."), card("finisher")]);
    expect(check.tone).toBe("ok");
    expect(text(check.segments)).toBe("Yara Q. goes in goal.");
  });

  it("promises only the strongest on the night when there are several", () => {
    expect(text(keeperCheck([card("goalkeeper"), card("goalkeeper")]).segments)).toBe(
      "Your strongest Goalkeeper on the night goes in goal; the other plays outfield.",
    );
    expect(
      text(keeperCheck([card("goalkeeper"), card("goalkeeper"), card("goalkeeper")]).segments),
    ).toContain("the others play outfield");
  });

  it("warns when there is none", () => {
    const check = keeperCheck([card("defender"), card("all_rounder")]);
    expect(check.tone).toBe("warn");
    expect(text(check.segments)).toBe(
      "No Goalkeeper in your five. Your best defender goes in goal, and keeps goal much worse than a real one.",
    );
  });
});

describe("load last week's five", () => {
  const rows = [
    { slot: 1, player_id: "dirk" },
    { slot: 2, player_id: "mo" },
    { slot: 3, player_id: "esther" },
    { slot: 4, player_id: "tess" },
    { slot: 5, player_id: "wout" },
  ];

  it("keeps each slot's position and opens the slots of Players no longer owned", () => {
    const result = prefillSlots(rows, new Set(["dirk", "mo", "esther"]), 5);
    expect(result.slots).toEqual(["dirk", "mo", "esther", null, null]);
    expect(result.lostPlayerIds).toEqual(["tess", "wout"]);
    expect(result.lostSlots).toEqual([4, 5]);
  });

  it("keeps a slot open in the middle and ignores slots outside the squad", () => {
    const result = prefillSlots(
      [...rows, { slot: 9, player_id: "stray" }],
      new Set(["dirk", "esther", "tess", "wout"]),
      5,
    );
    expect(result.slots).toEqual(["dirk", null, "esther", "tess", "wout"]);
    expect(result.lostSlots).toEqual([2]);
  });

  it("words the notice as HANDOFF has it", () => {
    expect(text(prefillNotice(["Tess F.", "Wout Y."], [4, 5]))).toBe(
      "Loaded last week's five. Tess F. and Wout Y. aren't in your collection any more, so slots 4 and 5 are open. Nothing is saved until you press Save.",
    );
    expect(text(prefillNotice(["Tess F."], [4]))).toContain(
      "Tess F. isn't in your collection any more, so slot 4 is open.",
    );
    expect(text(prefillNotice([], []))).toBe(
      "Loaded last week's five. Nothing is saved until you press Save.",
    );
    expect(prefillNotice([], [])[0]).toEqual({ text: "Loaded last week's five.", strong: true });
  });

  it("joins names in plain English", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("saveStatus", () => {
  it("is 'none' with nothing saved and nothing chosen", () => {
    expect(saveStatus([], [])).toBe("none");
    expect(saveStatus([], ["c1"])).toBe("dirty");
  });

  it("is 'saved' only when the cards a save would send are exactly the saved ones", () => {
    expect(saveStatus(["c1", "c2"], ["c2", "c1"])).toBe("saved");
    expect(saveStatus(["c1", "c2"], ["c1"])).toBe("dirty");
    // A saved copy sold since: another copy of the Player would be sent.
    expect(saveStatus(["c1", "c2"], ["c1", "c9"])).toBe("dirty");
  });
});

describe("strongest copy per Player", () => {
  const injured = new Set(["p-injured"]);

  it("prefers the higher OVR, then the uninjured copy, then the card id", () => {
    const cards = [
      { card_id: "b", player_id: "p1", is_live: true, ovr: 50 },
      { card_id: "a", player_id: "p1", is_live: false, ovr: 55 },
      { card_id: "z", player_id: "p2", is_live: true, ovr: 40 },
      { card_id: "y", player_id: "p2", is_live: true, ovr: 40 },
    ];
    const result = strongestCopies(cards, injured);
    expect(result.map(({ card, copies }) => [card.card_id, copies])).toEqual([
      ["a", 2],
      ["y", 2],
    ]);
  });

  it("plays a Special edition over an injured Player's Live copy of the same OVR", () => {
    const live = { card_id: "live", player_id: "p-injured", is_live: true, ovr: 60 };
    const special = { card_id: "special", player_id: "p-injured", is_live: false, ovr: 60 };
    expect(strongestCopies([live, special], injured)[0].card.card_id).toBe("special");
    expect(copyStrengthPpm(live, injured)).toBeLessThan(copyStrengthPpm(special, injured));
  });

  it("weighs OVR through the engine's flattened factor, not raw OVR", () => {
    // The injured fitness costs more than a few OVR points at the factor's slope.
    const live = { card_id: "live", player_id: "p-injured", is_live: true, ovr: 62 };
    const special = { card_id: "special", player_id: "p-injured", is_live: false, ovr: 60 };
    expect(ovrFactorPpm(62)).toBeGreaterThan(ovrFactorPpm(60));
    expect(strongestCopies([live, special], injured)[0].card.card_id).toBe("special");
  });
});

describe("words for the picker", () => {
  it("names a round from the end of the bracket", () => {
    expect(stageName(5, 5)).toBe("the final");
    expect(stageName(4, 5)).toBe("the semi-finals");
    expect(stageName(3, 5)).toBe("the quarter-finals");
    expect(stageName(2, 5)).toBe("round 2");
  });

  it("says how many trialists a starter squad fields", () => {
    expect(starterNotice(3, 5)).toBe("You have 3 Players, so 2 trialists make up your five.");
    expect(starterNotice(4, 5)).toBe("You have 4 Players, so 1 trialist makes up your five.");
    expect(starterNotice(1, 5)).toBe("You have 1 Player, so 4 trialists make up your five.");
    expect(starterNotice(5, 5)).toBeNull();
    expect(starterNotice(0, 5)).toBeNull();
  });

  it("maps save_midweek_squad's refusals to members' words", () => {
    expect(squadSaveError("22023", "each card must be a different Player")).toBe(
      "Pick between one and five cards you own, one per Player.",
    );
    expect(squadSaveError("P0001", "squads are locked")).toBe(
      "Squads are locked. Your five from before 20:00 is the one that plays.",
    );
    expect(squadSaveError("P0001", "you have opted out of Midweek Madness")).toBe(
      "You've opted out. Take part again to pick a five.",
    );
    expect(squadSaveError("P0002", "no Midweek Madness tournament is open")).toContain(
      "no Midweek",
    );
    expect(squadSaveError("42501", "an active KUT account is required")).toContain("active KUT");
    expect(squadSaveError("XX000", "boom")).toBe("Something went wrong. Please try again.");
  });
});

describe("last week", () => {
  it("says how far the member got, their coins and the champion", () => {
    const base = { rounds: 5, entered: true, isChampion: false, championName: "Lieke" };
    expect(
      lastWeekSummary({
        ...base,
        rewards: [
          { round_no: 1, amount: 17 },
          { round_no: 2, amount: 33 },
          { round_no: 3, amount: 50 },
        ],
      }),
    ).toBe("You reached the semi-finals. +100 KUT Coins. Lieke won it.");
    expect(lastWeekSummary({ ...base, rewards: [] })).toBe(
      "You went out in round 1. Lieke won it.",
    );
    expect(lastWeekSummary({ ...base, entered: false, rewards: [] })).toBe(
      "You sat it out. Lieke won it.",
    );
    expect(
      lastWeekSummary({
        ...base,
        isChampion: true,
        rewards: [1, 2, 3, 4, 5].map((round_no) => ({ round_no, amount: 50 })),
      }),
    ).toBe("You won it! +250 KUT Coins.");
  });

  it("words a skip or a void by its reason code", () => {
    const week = { lock_at: "2026-10-07T18:00:00Z", void_note: null };
    expect(
      skipOrVoidText({ ...week, status: "skipped", status_reason: "club_break" }, 4),
    ).toContain("No Midweek Madness on Wed 7 Oct. There was no TFH session the week before");
    expect(
      skipOrVoidText({ ...week, status: "skipped", status_reason: "too_few_entrants" }, 4),
    ).toBe(
      "No Midweek Madness on Wed 7 Oct. Fewer than 4 clubs were in, and a bracket needs 4. Nothing was played or paid.",
    );
    expect(
      skipOrVoidText(
        { ...week, status: "void", status_reason: "admin_void", void_note: "Roster mix-up" },
        4,
      ),
    ).toBe(
      "Wed 7 Oct was called off by an admin. “Roster mix-up” No results are shown and no coins were paid for that night.",
    );
    expect(skipOrVoidText({ ...week, status: "complete", status_reason: null }, 4)).toBeNull();
  });
});

describe("the opt-out", () => {
  it("names the week an opt-in or opt-out next affects", () => {
    expect(nextEntryWeekLabel(current(), new Date("2026-10-06T12:00:00Z"))).toBe("Wed 7 Oct");
    expect(nextEntryWeekLabel(current(), new Date("2026-10-07T19:00:00Z"))).toBe("Wed 14 Oct");
    expect(
      nextEntryWeekLabel(current({ status: "complete" }), new Date("2026-10-08T12:00:00Z")),
    ).toBe("Wed 14 Oct");
    expect(nextEntryWeekLabel(current({ lock_at: null }), new Date())).toBeNull();
  });

  it("words the confirmation by what opting out would withdraw", () => {
    expect(optOutConfirmText({ locked: false, hasSavedSquad: true, weekLabel: "Wed 7 Oct" })).toBe(
      "Your saved five for Wed 7 Oct will be removed and you won't be entered. You can come back any time before a Wednesday's lock.",
    );
    expect(
      optOutConfirmText({ locked: false, hasSavedSquad: false, weekLabel: "Wed 7 Oct" }),
    ).toContain("You won't be entered for Wed 7 Oct, picked or auto");
    expect(optOutConfirmText({ locked: true, hasSavedSquad: false, weekLabel: null })).toContain(
      "Tonight's squads are already locked, so this applies from next Wednesday.",
    );
  });
});
