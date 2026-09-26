import type { Archetype } from "@/game/archetypes";
import type { ChanceType } from "@/game/midweek/config";
import type { MatchEvent, Side } from "@/game/midweek/match";
import type { EntryCardRow, EventRow, MatchRow } from "../rows";
import { pickLabel, renderMatchReport } from "./render";
import type { MatchReport, ReportInput, ReportSide } from "./types";

/**
 * Builds a report input from the stored rows: the database twin of
 * `from-engine.ts`, which maps an engine run the same way. The worker stores
 * the engine's result unchanged (ADR-095), so a stored match renders exactly
 * the report its engine run would (`tests/unit/midweek-report-db.test.ts`).
 *
 * Server only: the renderer keys phrases with `rng.ts`, which needs
 * `node:crypto`.
 */

function toSide(rows: readonly EntryCardRow[]): ReportSide | null {
  if (rows.length === 0) return null;
  const cards = [...rows].sort((a, b) => a.slot - b.slot);
  return {
    manager: cards[0].manager_name,
    auto: cards[0].auto,
    keeperSlot: cards[0].keeper_slot,
    keeperless: cards[0].keeperless,
    cards: cards.map((card) => ({
      name: card.trialist ? null : card.player_name,
      trialist: card.trialist,
      injured: card.injured,
      ovr: card.ovr,
      archetype: card.archetype as Archetype,
      ovrFactorPpm: card.ovr_factor_ppm,
      formRollPpm: card.form_roll_ppm,
      pickFactorPpm: card.pick_factor_ppm,
      fitnessPpm: card.fitness_ppm,
      handicapPpm: card.handicap_ppm,
      powerPpm: card.power_ppm,
      picks: card.picks,
      owners: card.owners,
    })),
  };
}

function toEvent(row: EventRow): MatchEvent {
  if (row.kind === "toss") return { kind: "toss", side: row.side };
  if (row.kind === "penalty") {
    return {
      kind: "penalty",
      round: row.penalty_round as number,
      side: row.side,
      kicker: row.kicker_slot as number,
      keeper: row.keeper_slot as number,
      outcome: row.outcome as "goal" | "save" | "woodwork" | "wide",
      pGoalPpm: row.p_goal_ppm as number,
    };
  }
  return {
    kind: "chance",
    minute: row.minute as number,
    side: row.side,
    creator: row.creator_slot as number,
    shooter: row.shooter_slot as number,
    chanceType: row.chance_type as ChanceType,
    outcome: row.outcome as "goal" | "save" | "block" | "woodwork" | "wide",
    pGoalPpm: row.p_goal_ppm as number,
    defender: row.defender_slot,
  };
}

/**
 * The report input for one stored match, or null when there is nothing to
 * report: a bye, or a side whose entry isn't visible.
 */
export function reportInputFromRows(input: {
  seedHash: string;
  rounds: number;
  match: MatchRow;
  events: readonly EventRow[];
  entries: readonly EntryCardRow[];
  /** True once the week is complete, when owner counts are published (D3). */
  ownersPublished: boolean;
}): ReportInput | null {
  const { match } = input;
  if (match.bye || match.side_1_user_id === null) return null;
  const side0 = toSide(input.entries.filter((row) => row.user_id === match.side_0_user_id));
  const side1 = toSide(input.entries.filter((row) => row.user_id === match.side_1_user_id));
  if (!side0 || !side1) return null;
  return {
    seedHash: input.seedHash,
    round: match.round,
    rounds: input.rounds,
    pairing: match.pairing,
    sides: [side0, side1],
    outcome: {
      goals: [match.side_0_goals ?? 0, match.side_1_goals ?? 0],
      penalties:
        match.side_0_penalties === null || match.side_1_penalties === null
          ? null
          : [match.side_0_penalties, match.side_1_penalties],
      winnerSide: match.winner_side,
      winChancePpm: match.win_chance_ppm ?? 500_000,
      dayRollsPpm: [match.side_0_day_rolls_ppm ?? [], match.side_1_day_rolls_ppm ?? []],
      events: [...input.events].sort((a, b) => a.seq - b.seq).map(toEvent),
    },
    ownersPublished: input.ownersPublished,
  };
}

/**
 * What a report page shows. Its text (headline, facts, timeline, shoot-out) is
 * always rendered as it first appeared, which is before the week completes and
 * so without owner counts: members quote reports on the night, and the text
 * never changes afterwards (ADR-098). Once the counts are published, the "why"
 * panel gains its pick labels (D3).
 */
export function renderStoredReport(input: ReportInput): MatchReport {
  const report = renderMatchReport({ ...input, ownersPublished: false });
  if (!input.ownersPublished) return report;
  return {
    ...report,
    why: report.why.map((side, s) => ({
      ...side,
      cards: side.cards.map((card, slot) => ({
        ...card,
        pickLabel: pickLabel(input.sides[s as Side].cards[slot], input.sides[s as Side].auto, true),
      })),
    })) as MatchReport["why"],
  };
}
