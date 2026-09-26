/**
 * The rows the Midweek results views return (migrations 20261005000000 and
 * 20261006000000, BUILD_SPEC §44.14). Stored results use the engine's 0-based
 * indexes: slot 0–4, side 0–1, pairing from 0. Pages read the views with
 * `select("*")`, so a column a later migration appends changes nothing here.
 *
 * Client-safe: types only.
 */

/** A `kut.midweek_matches_public` row: a revealed pairing, a round-1 bye included. */
export type MatchRow = {
  match_id: string;
  tournament_id: string;
  week_start: string;
  round: number;
  pairing: number;
  bye: boolean;
  side_0_user_id: string;
  side_0_name: string;
  side_1_user_id: string | null;
  side_1_name: string | null;
  side_0_goals: number | null;
  side_1_goals: number | null;
  /** Set only when a draw went to penalties. */
  side_0_penalties: number | null;
  side_1_penalties: number | null;
  winner_side: 0 | 1;
  winner_user_id: string;
  /** Side 0's pre-match win chance. */
  win_chance_ppm: number | null;
  side_0_day_rolls_ppm: number[] | null;
  side_1_day_rolls_ppm: number[] | null;
  reveal_at: string;
};

/** A `kut.midweek_events_public` row, in engine order (`seq`). */
export type EventRow = {
  match_id: string;
  seq: number;
  kind: "chance" | "penalty" | "toss";
  side: 0 | 1;
  minute: number | null;
  penalty_round: number | null;
  creator_slot: number | null;
  shooter_slot: number | null;
  defender_slot: number | null;
  kicker_slot: number | null;
  keeper_slot: number | null;
  chance_type: string | null;
  outcome: "goal" | "save" | "block" | "woodwork" | "wide" | null;
  p_goal_ppm: number | null;
};

/** A `kut.midweek_entries_public` row: one entered card with its lock-time snapshot. */
export type EntryCardRow = {
  tournament_id: string;
  week_start: string;
  user_id: string;
  manager_name: string;
  auto: boolean;
  keeper_slot: number;
  keeperless: boolean;
  slot: number;
  trialist: boolean;
  player_id: string | null;
  player_name: string | null;
  photo_path: string | null;
  ovr: number;
  archetype: string;
  /** The injury flag at the lock, which is what the engine used (ADR-085). */
  injured: boolean;
  ovr_factor_ppm: number;
  form_roll_ppm: number;
  pick_factor_ppm: number;
  fitness_ppm: number;
  handicap_ppm: number;
  power_ppm: number;
  /** Null until the week is complete (owner decision D3). */
  picks: number | null;
  /** Null until complete, and below three owners always (ADR-091). */
  owners: number | null;
};

/** A `kut.midweek_pick_shares_public` row, for a complete week. */
export type PickShareRow = {
  tournament_id: string;
  player_id: string;
  player_name: string;
  photo_path: string | null;
  picks: number;
  owners: number | null;
  pick_factor_ppm: number;
};

/** A `kut.my_midweek_rewards` row: one win the caller was paid for. */
export type RewardRow = {
  tournament_id: string;
  week_start: string;
  round_no: number;
  match_id: string;
  bye: boolean;
  amount: number;
  paid_at: string;
};
