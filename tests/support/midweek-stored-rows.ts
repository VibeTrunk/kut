import { readFileSync } from "node:fs";
import path from "node:path";
import { MIDWEEK } from "@/game/midweek/config";
import type { PlayedMatch, SimulatedTournament, TournamentResult } from "@/game/midweek/tournament";
import type { EntryCardRow, EventRow, MatchRow } from "@/lib/midweek/rows";
import type { Directory } from "@/lib/midweek/report/from-engine";

/**
 * The golden tournaments stored the way `kut._mm_lock_tournament` stores them
 * and read back the way the views return them (ADR-098), for tests of
 * anything that reads stored rows.
 */

export const golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/midweek-golden.json"), "utf8"),
) as { tournaments: { name: string; seedHash: string; result: TournamentResult }[] };

export const directory: Directory = {
  player: (id) => `Player ${id.slice(0, 4)}`,
  manager: (id) => `Manager ${id.slice(0, 4)}`,
};

/** `kut.midweek_entries_public`, as it reads for a complete week (or, with `complete` false, before). */
export function entryRows(result: SimulatedTournament, complete: boolean): EntryCardRow[] {
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
        balance_ppm: entry.balancePpm,
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
export function matchRow(match: PlayedMatch): MatchRow {
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
export function eventRows(match: PlayedMatch): EventRow[] {
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
      const base = {
        ...empty,
        match_id: `m${match.round}-${match.pairing}`,
        seq,
        kind: event.kind,
        side: event.side,
      };
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

export const simulated = golden.tournaments.filter(
  (t): t is { name: string; seedHash: string; result: SimulatedTournament } =>
    t.result.status === "simulated",
);
