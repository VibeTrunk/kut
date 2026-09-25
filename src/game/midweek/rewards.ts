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
