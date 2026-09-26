/**
 * Pure helpers for `/admin/midweek` (PR 8, ADR-098): the admin functions'
 * refusals in words, the void note's bounds, and the rehearsal's shape
 * (BUILD_SPEC §44.14, `kut.admin_midweek_rehearsal`). Client-safe.
 */

import { roundPayouts } from "@/game/midweek/rewards";
import { formatDayDate } from "./entry";
import type { MidweekStatus } from "./entry";

/** A `kut.midweek_admin_overview` row (admins only). */
export type MidweekAdminOverview = {
  enabled: boolean;
  switched_at: string | null;
  tournament_id: string | null;
  week_start: string | null;
  status: MidweekStatus | null;
  lock_at: string | null;
  final_reveal_at: string | null;
  seed_hash: string | null;
  squads_saved: number | null;
  opted_out: number | null;
  last_run_at: string | null;
  last_run_error: string | null;
};

/** What `kut.admin_midweek_rehearsal()` returns (§44.14). */
export type MidweekRehearsal = {
  ran_at: string;
  tournament_id: string | null;
  week_start: string;
  lock_at: string;
  status: "simulated" | "skipped";
  would_skip: "club_break" | "too_few_entrants" | null;
  field: number;
  picked: number;
  auto: number;
  opted_out: number;
  auto_managers: string[];
  size: number | null;
  rounds: number | null;
  by_round: {
    round: number;
    reveal_at: string;
    pairings: {
      pairing: number;
      bye: boolean;
      side_0: string | null;
      side_1: string | null;
      goals: [number, number] | null;
      penalties: [number, number] | null;
      winner: string | null;
    }[];
  }[];
  champion: { user_id: string; name: string | null } | null;
  warnings: { level: string; message: string }[];
};

/** The void note members read: 3–200 characters, trimmed, as `admin_void_midweek` checks. */
export const VOID_NOTE_MIN = 3;
export const VOID_NOTE_MAX = 200;

export function isValidVoidNote(note: string): boolean {
  const trimmed = note.trim();
  return trimmed.length >= VOID_NOTE_MIN && trimmed.length <= VOID_NOTE_MAX;
}

/**
 * `admin_void_midweek`'s refusals (42501, 22023, P0002, P0001) in the admin's
 * words. Both P0001 cases share a code, so the message decides.
 */
export function voidError(
  code: string | undefined,
  message: string | undefined,
  lockAt: string | null,
): string {
  const week = lockAt ? formatDayDate(lockAt) : "This week";
  if (code === "42501") return "Only admins can void a Midweek week.";
  if (code === "22023") {
    return `Give a reason of ${VOID_NOTE_MIN} to ${VOID_NOTE_MAX} characters; every member reads it.`;
  }
  if (code === "P0002") return "That week no longer exists. Reload the page.";
  if (code === "P0001" && message?.includes("paid")) {
    return `${week} has been paid, so it can't be voided. Correct a member's coins with a wallet adjustment in Economy.`;
  }
  if (code === "P0001" && message?.includes("did not run")) {
    return `${week} didn't run, so there is nothing to void.`;
  }
  return "Something went wrong. Please try again.";
}

/** The switch's refusals (42501, 22023). */
export function switchError(code: string | undefined): string {
  if (code === "42501") return "Only admins can switch Midweek Madness on or off.";
  return "Something went wrong. Please try again.";
}

/** A row per round of the rehearsal: matches, byes, what a win pays, and when it would be out. */
export function rehearsalRounds(rehearsal: MidweekRehearsal) {
  const pays = rehearsal.rounds ? roundPayouts(rehearsal.rounds) : [];
  return rehearsal.by_round.map((round) => {
    const byes = round.pairings.filter((pairing) => pairing.bye).length;
    return {
      round: round.round,
      matches: round.pairings.length - byes,
      byes,
      pays: pays[round.round - 1] ?? 0,
      revealAt: round.reveal_at,
    };
  });
}

/** The status word on the admin's "This week" panel. */
export function statusWord(status: MidweekStatus | null): string {
  switch (status) {
    case "open":
      return "Open";
    case "simulated":
      return "Running tonight";
    case "complete":
      return "Complete";
    case "skipped":
      return "Skipped";
    case "void":
      return "Void";
    default:
      return "None yet";
  }
}
