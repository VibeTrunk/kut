import { MIDWEEK, PPM, type MidweekConfig } from "./config";
import { idiv, mulPpm } from "./fixed";
import { uniform, type Rng } from "./rng";

/**
 * A card's week-long power (BUILD_SPEC §44.3):
 *
 *   card_power = ovr_factor × form_roll × pick_factor × fitness × auto_factor
 *
 * multiplied left to right in ppm, flooring after each step. A trialist uses
 * its own factor in place of the auto factor.
 */

/** 1.00 at OVR 30, `factorMaxPpm` at OVR 83, linear and clamped. */
export function ovrFactorPpm(ovr: number, cfg: MidweekConfig = MIDWEEK): number {
  const { min, max, factorMaxPpm } = cfg.ovr;
  const clamped = Math.min(Math.max(Math.trunc(ovr), min), max);
  return PPM + idiv((factorMaxPpm - PPM) * (clamped - min), max - min);
}

/**
 * One weekly form roll. The mean of `dice` uniform ppm draws is mapped
 * piecewise: its lower half onto [min, mode) and its upper half onto
 * [mode, max), so most rolls land near the mode.
 */
export function formRollPpm(rng: Rng, tag: string, cfg: MidweekConfig = MIDWEEK): number {
  const { minPpm, modePpm, maxPpm, dice } = cfg.form;
  let sum = 0;
  for (let die = 0; die < dice; die += 1) sum += uniform(rng, `${tag}:${die}`, PPM);
  const u = idiv(sum, dice);
  const half = PPM / 2;
  if (u < half) return minPpm + idiv((modePpm - minPpm) * u, half);
  return modePpm + idiv((maxPpm - modePpm) * (u - half), PPM - half);
}

/** (picks + 1) / (owners + 3), in ppm. `owners` counts every entrant owning the Player. */
export function pickSharePpm(picks: number, owners: number, cfg: MidweekConfig = MIDWEEK): number {
  if (picks > owners) throw new Error("A Player cannot be picked by more entrants than own it");
  return idiv((picks + cfg.pick.smoothingPicks) * PPM, owners + cfg.pick.smoothingOwners);
}

/** Piecewise linear over `cfg.pick.points`; each segment is walked in whichever direction it slopes. */
export function pickFactorPpm(sharePpm: number, cfg: MidweekConfig = MIDWEEK): number {
  const points = cfg.pick.points;
  const share = Math.min(Math.max(sharePpm, points[0][0]), points[points.length - 1][0]);
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1];
    const [x1, y1] = points[index];
    if (share > x1) continue;
    const step = share - x0;
    if (y1 <= y0) return y0 - idiv((y0 - y1) * step, x1 - x0);
    return y0 + idiv((y1 - y0) * step, x1 - x0);
  }
  return points[points.length - 1][1];
}

/** A fresh per-match roll, uniform in [PPM − spread, PPM + spread]. */
export function dayRollPpm(rng: Rng, tag: string, cfg: MidweekConfig = MIDWEEK): number {
  const spread = cfg.dayRollSpreadPpm;
  return PPM - spread + uniform(rng, tag, 2 * spread + 1);
}

export type PowerFactors = {
  ovrFactorPpm: number;
  formRollPpm: number;
  pickFactorPpm: number;
  fitnessPpm: number;
  /** The auto-squad penalty, the trialist factor, or PPM. */
  handicapPpm: number;
};

export function cardPowerPpm(factors: PowerFactors): number {
  let power = factors.ovrFactorPpm;
  power = mulPpm(power, factors.formRollPpm);
  power = mulPpm(power, factors.pickFactorPpm);
  power = mulPpm(power, factors.fitnessPpm);
  power = mulPpm(power, factors.handicapPpm);
  return power;
}
