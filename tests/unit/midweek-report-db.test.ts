import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIDWEEK } from "@/game/midweek/config";
import type { PlayedMatch, SimulatedTournament, TournamentResult } from "@/game/midweek/tournament";
import type { EntryCardRow, EventRow, MatchRow } from "@/lib/midweek/rows";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { reportInput, type Directory } from "@/lib/midweek/report/from-engine";
import { renderMatchReport } from "@/lib/midweek/report/render";

/**
 * The database twin of the report adapter (ADR-098): a golden tournament,
 * stored the way `kut._mm_lock_tournament` stores it and read back the way the
 * views return it, renders exactly the report its engine run renders.
 */

const golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/midweek-golden.json"), "utf8"),
) as { tournaments: { name: string; seedHash: string; result: TournamentResult }[] };

const directory: Directory = {
  player: (id) => `Player ${id.slice(0, 4)}`,
  manager: (id) => `Manager ${id.slice(0, 4)}`,
};

/** `kut.midweek_entries_public`, as it reads for a complete week (or, with `complete` false, before). */
function entryRows(result: SimulatedTournament, complete: boolean): EntryCardRow[] {
  const shares = new Map(result.pickShares.map((share) => [share.playerId, share]));
  return result.entries.flatMap((entry) =>
    entry.cards.map((card) => {
      const share = card.playerId === null ? undefined : shares.get(card.playerId);
      return {
        tournament_id: "t",
        week_start: "2026-10-05",
        user_id: entry.userId,
        manager_name: directory.manager(entry.userId),
        auto: entry.auto,
        keeper_slot: entry.keeperSlot,
        keeperless: entry.keeperless,
        slot: card.slot,
        trialist: card.trialist,
        player_id: card.playerId,
        player_name: card.playerId === null ? null : directory.player(card.playerId),
        photo_path: null,
        ovr: card.ovr,
        archetype: card.archetype,
        injured: card.injured,
        ovr_factor_ppm: card.ovrFactorPpm,
        form_roll_ppm: card.formRollPpm,
        pick_factor_ppm: card.pickFactorPpm,
        fitness_ppm: card.fitnessPpm,
        handicap_ppm: card.handicapPpm,
        power_ppm: card.powerPpm,
        picks: complete && share ? share.picks : null,
        owners: complete && share && share.owners >= MIDWEEK.ownerCountMin ? share.owners : null,
      };
    }),
  );
}

/** `kut.midweek_matches_public` for a played match. */
function matchRow(match: PlayedMatch): MatchRow {
  const { outcome } = match;
  return {
    match_id: `m${match.round}-${match.pairing}`,
    tournament_id: "t",
    week_start: "2026-10-05",
    round: match.round,
    pairing: match.pairing,
    bye: false,
    side_0_user_id: match.userIds[0],
    side_0_name: directory.manager(match.userIds[0]),
    side_1_user_id: match.userIds[1],
    side_1_name: directory.manager(match.userIds[1]),
    side_0_goals: outcome.goals[0],
    side_1_goals: outcome.goals[1],
    side_0_penalties: outcome.penalties?.[0] ?? null,
    side_1_penalties: outcome.penalties?.[1] ?? null,
    winner_side: outcome.winnerSide,
    winner_user_id: match.userIds[outcome.winnerSide],
    win_chance_ppm: outcome.winChancePpm,
    side_0_day_rolls_ppm: outcome.dayRollsPpm[0],
    side_1_day_rolls_ppm: outcome.dayRollsPpm[1],
    reveal_at: "2026-10-07T18:30:00.000Z",
  };
}

/** `kut.midweek_events_public`: the worker's column mapping, in reverse order to prove the sort. */
function eventRows(match: PlayedMatch): EventRow[] {
  const empty = {
    minute: null,
    penalty_round: null,
    creator_slot: null,
    shooter_slot: null,
    defender_slot: null,
    kicker_slot: null,
    keeper_slot: null,
    chance_type: null,
    outcome: null,
    p_goal_ppm: null,
  };
  return match.outcome.events
    .map((event, seq): EventRow => {
      const base = { ...empty, match_id: "m", seq, kind: event.kind, side: event.side };
      if (event.kind === "chance") {
        return {
          ...base,
          minute: event.minute,
          creator_slot: event.creator,
          shooter_slot: event.shooter,
          defender_slot: event.defender,
          chance_type: event.chanceType,
          outcome: event.outcome,
          p_goal_ppm: event.pGoalPpm,
        };
      }
      if (event.kind === "penalty") {
        return {
          ...base,
          penalty_round: event.round,
          kicker_slot: event.kicker,
          keeper_slot: event.keeper,
          outcome: event.outcome,
          p_goal_ppm: event.pGoalPpm,
        };
      }
      return base;
    })
    .reverse();
}

const simulated = golden.tournaments.filter(
  (t): t is { name: string; seedHash: string; result: SimulatedTournament } =>
    t.result.status === "simulated",
);

describe("midweek report from stored rows", () => {
  it("covers golden tournaments with shoot-outs", () => {
    expect(simulated.length).toBeGreaterThanOrEqual(6);
    expect(simulated.some((t) => t.result.matches.some((m) => m.outcome.penalties))).toBe(true);
  });

  it("builds the same input and report as the engine run, for every golden match", () => {
    for (const { name, seedHash, result } of simulated) {
      const entries = entryRows(result, true);
      for (const match of result.matches) {
        const fromDb = reportInputFromRows({
          seedHash,
          rounds: result.rounds,
          match: matchRow(match),
          events: eventRows(match),
          entries,
          ownersPublished: true,
        });
        const fromEngine = reportInput(result, match, seedHash, directory);
        expect(fromDb, name).toEqual(fromEngine);
        expect(renderMatchReport(fromDb!), name).toEqual(renderMatchReport(fromEngine));
      }
    }
  });

  it("has no report for a bye", () => {
    const { seedHash, result } = simulated.find((t) => t.result.byes.length > 0)!;
    const bye = result.byes[0];
    const row: MatchRow = {
      ...matchRow(result.matches[0]),
      round: 1,
      pairing: bye.pairing,
      bye: true,
      side_0_user_id: bye.userId,
      side_1_user_id: null,
      side_1_name: null,
    };
    expect(
      reportInputFromRows({
        seedHash,
        rounds: result.rounds,
        match: row,
        events: [],
        entries: entryRows(result, true),
        ownersPublished: true,
      }),
    ).toBeNull();
  });

  it("keeps a report's text the same once the week completes, and only then labels owner counts", () => {
    let labelled = 0;
    for (const { seedHash, result } of simulated) {
      for (const match of result.matches) {
        const build = (complete: boolean) =>
          renderStoredReport(
            reportInputFromRows({
              seedHash,
              rounds: result.rounds,
              match: matchRow(match),
              events: eventRows(match),
              entries: entryRows(result, complete),
              ownersPublished: complete,
            })!,
          );
        const before = build(false);
        const after = build(true);
        expect(after.headline).toBe(before.headline);
        expect(after.facts).toEqual(before.facts);
        expect(after.timeline).toEqual(before.timeline);
        expect(after.shootout).toEqual(before.shootout);
        after.why.forEach((side, s) => {
          side.cards.forEach((card, slot) => {
            const earlier = before.why[s].cards[slot];
            expect({ ...card, pickLabel: null }).toEqual({ ...earlier, pickLabel: null });
            if (card.trialist) expect(card.pickLabel).toBeNull();
            else if (side.auto) expect(earlier.pickLabel).toBe("auto squad");
            else {
              expect(earlier.pickLabel).toBeNull();
              expect(card.pickLabel).toMatch(/^(a rare pick|\d+ of ([3-9]|\d{2,}) owners)$/);
              labelled += 1;
            }
          });
        });
      }
    }
    expect(labelled).toBeGreaterThan(0);
  });
});
