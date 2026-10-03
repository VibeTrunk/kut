import { MIDWEEK, type MidweekConfig } from "./config";
import { idiv } from "./fixed";

/**
 * Coins per match won (BUILD_SPEC §44.7). Round r of R pays
 * round_half_up(total × r / T) with T = R(R+1)/2, and the final absorbs the
 * rounding, so a champion collects exactly `championTotal`.
 */
export function roundPayouts(rounds: number, cfg: MidweekConfig = MIDWEEK): number[] {
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new Error("A tournament has at least one round");
  const total = cfg.championTotal;
  const triangle = idiv(rounds * (rounds + 1), 2);
  const pays: number[] = [];
  for (let round = 1; round < rounds; round += 1) {
    pays.push(idiv(2 * total * round + triangle, 2 * triangle));
  }
  pays.push(total - pays.reduce((sum, pay) => sum + pay, 0));
  return pays;
}

/** The most correct predictions pay in one night (ADR-118). */
export const PREDICTION_COINS_CAP = 30;

/**
 * Coins per correct prediction (BUILD_SPEC §44.7, ADR-118): the cap split over
 * the matches after round 1, which a member out in round 1 can predict, so 2
 * with 17–32 entrants, 4 with 9–16, 10 with 5–8 and 30 with 4. The twin of
 * `kut._mm_prediction_coins`; the database pays, this only displays.
 */
export function predictionCoins(rounds: number): number {
  if (!Number.isInteger(rounds) || rounds < 2) return 0;
  return idiv(PREDICTION_COINS_CAP, 2 ** (rounds - 1) - 1);
}
