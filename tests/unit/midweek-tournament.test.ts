import { describe, expect, it } from "vitest";
import type { Archetype } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { bracketShape, drawBracket } from "@/game/midweek/bracket";
import { roundPayouts } from "@/game/midweek/rewards";
import { shaRng } from "@/game/midweek/rng";
import {
  autoSquad,
  buildField,
  simulateTournament,
  type EngineCard,
  type EntrantInput,
  type SimulatedTournament,
} from "@/game/midweek/tournament";

const seed = (n: number) => n.toString(16).padStart(64, "0");

let nextCard = 0;
function card(player: number, ovr = 50, archetype: Archetype = "all_rounder"): EngineCard {
  nextCard += 1;
  return { cardId: `c${nextCard}`, playerId: `p${player}`, ovr, archetype, injured: false };
}

function field(size: number, picked = true): EntrantInput[] {
  return Array.from({ length: size }, (_, i) => {
    const owned = [card(i), card(i + 1, 60), card(i + 2, 40, "goalkeeper")];
    return { userId: `u${String(i).padStart(2, "0")}`, owned, saved: picked ? owned : [] };
  });
}

describe("midweek bracket", () => {
  it("sizes the bracket to the next power of two", () => {
    expect(bracketShape(4)).toEqual({ size: 4, rounds: 2 });
    expect(bracketShape(5)).toEqual({ size: 8, rounds: 3 });
    expect(bracketShape(22)).toEqual({ size: 32, rounds: 5 });
    expect(() => bracketShape(1)).toThrow();
  });

  it("seats every entrant once and draws the byes at random", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `u${i}`);
    const placements = new Set<string>();
    for (let n = 0; n < 50; n += 1) {
      const bracket = drawBracket(shaRng(seed(n)), ids);
      const seated = bracket.pairings.flat().filter((id): id is string => id !== null);
      expect([...seated].sort()).toEqual([...ids].sort());
      const byes = bracket.pairings.flatMap(([, second], i) => (second === null ? [i] : []));
      expect(byes).toHaveLength(16 - 11);
      placements.add(byes.join(","));
    }
    expect(placements.size).toBeGreaterThan(10);
  });
});

describe("midweek tournament", () => {
  it("skips a field below the minimum", () => {
    expect(simulateTournament(shaRng(seed(1)), field(MIDWEEK.minEntrants - 1))).toEqual({
      status: "skipped",
      reason: "too_few_entrants",
    });
  });

  it("is a pure function of the entrants and the seed, whatever their order", () => {
    const entrants = field(7);
    const a = simulateTournament(shaRng(seed(2)), entrants);
    expect(simulateTournament(shaRng(seed(2)), [...entrants].reverse())).toEqual(a);
    expect(simulateTournament(shaRng(seed(3)), entrants)).not.toEqual(a);
  });

  it("pays each win once, a bye like a win, and the champion exactly the total", () => {
    for (const size of [4, 5, 6, 9, 13]) {
      const result = simulateTournament(shaRng(seed(size)), field(size)) as SimulatedTournament;
      const pays = roundPayouts(result.rounds);
      const champion = result.payouts.filter((p) => p.userId === result.championUserId);
      expect(champion.reduce((sum, p) => sum + p.amount, 0)).toBe(MIDWEEK.championTotal);
      expect(result.byes).toHaveLength(result.size - size);
      for (const bye of result.byes) {
        expect(result.payouts).toContainEqual({
          userId: bye.userId,
          round: 1,
          amount: pays[0],
          bye: true,
        });
      }
      const perRound = new Map<string, number>();
      for (const payout of result.payouts) {
        const key = `${payout.round}:${payout.userId}`;
        perRound.set(key, (perRound.get(key) ?? 0) + 1);
      }
      expect(Math.max(...perRound.values())).toBe(1);
      expect(result.matches).toHaveLength(size - 1);
    }
  });

  it("fills empty slots with trialists", () => {
    const entrants = field(4).map((e) => ({ ...e, saved: e.saved.slice(0, 2) }));
    const { entries } = buildField(shaRng(seed(4)), entrants);
    for (const entry of entries) {
      expect(entry.cards.filter((c) => c.trialist)).toHaveLength(3);
      for (const trialist of entry.cards.filter((c) => c.trialist)) {
        expect(trialist.cardId).toBeNull();
        expect(trialist.archetype).toBe("all_rounder");
        expect(trialist.pickFactorPpm).toBe(MIDWEEK.pick.neutralPpm);
      }
    }
  });

  it("builds auto squads deterministically from distinct owned Players", () => {
    const owned = [card(1), card(1), card(2), card(3), card(4), card(5), card(6), card(7)];
    const entrant = { userId: "u1", owned, saved: [] };
    const squad = autoSquad(shaRng(seed(5)), entrant);
    expect(squad).toEqual(autoSquad(shaRng(seed(5)), entrant));
    expect(squad).toHaveLength(5);
    expect(new Set(squad.map((c) => c.playerId)).size).toBe(5);
    for (const c of squad) expect(owned).toContainEqual(c);
    expect(autoSquad(shaRng(seed(5)), { ...entrant, owned: owned.slice(0, 3) })).toHaveLength(2);
  });

  it("penalises auto squads and leaves them out of pick shares", () => {
    const entrants = field(5);
    entrants[0] = { ...entrants[0], saved: [] };
    const { entries, pickShares } = buildField(shaRng(seed(6)), entrants);
    const auto = entries.find((e) => e.userId === "u00")!;
    expect(auto.auto).toBe(true);
    for (const c of auto.cards) {
      expect(c.pickFactorPpm).toBe(MIDWEEK.pick.neutralPpm);
      expect(c.handicapPpm).toBeLessThanOrEqual(MIDWEEK.autoFactorPpm);
    }
    // Player p0 is owned by u00 only, which did not pick: an owner, never a pick.
    expect(pickShares.find((s) => s.playerId === "p0")).toMatchObject({ owners: 1, picks: 0 });
  });

  it("shares one form roll per Player across every squad", () => {
    const shared = [card(90, 55), card(91, 45)];
    const entrants = field(4).map((e) => ({ ...e, owned: [...e.owned, ...shared], saved: shared }));
    const { entries } = buildField(shaRng(seed(7)), entrants);
    const forms = new Set(
      entries.map((e) => e.cards.find((c) => c.playerId === "p90")!.formRollPpm),
    );
    expect(forms.size).toBe(1);
  });

  it("refuses squads the lock checks should have caught", () => {
    const [first, ...rest] = field(4);
    const duplicate = { ...first, saved: [first.owned[0], { ...first.owned[0], cardId: "other" }] };
    expect(() => buildField(shaRng(seed(8)), [duplicate, ...rest])).toThrow();
    const stranger = { ...first, saved: [card(99)] };
    expect(() => buildField(shaRng(seed(8)), [stranger, ...rest])).toThrow();
    expect(() => buildField(shaRng(seed(8)), [first, first, ...rest])).toThrow();
  });
});
