import { GAME_CONFIG } from "@/game/config";
import { ARCHETYPES, type Archetype } from "@/game/archetypes";

export { ARCHETYPES, type Archetype };

export type RarityTier =
  | "common"
  | "bronze"
  | "silver"
  | "gold"
  | "holo"
  | "elite";

/**
 * Live OVR range for each rarity tier. Derived from `getRarityTier` below and
 * the Live OVR bounds (30..83); kept as data so the "How KUT works" page can
 * render the tiers without re-deriving the boundaries.
 */
export const RARITY_BANDS: { tier: RarityTier; min: number; max: number }[] = [
  { tier: "common", min: 30, max: 39 },
  { tier: "bronze", min: 40, max: 49 },
  { tier: "silver", min: 50, max: 59 },
  { tier: "gold", min: 60, max: 69 },
  { tier: "holo", min: 70, max: 79 },
  { tier: "elite", min: 80, max: 83 },
];

export type Attributes = {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
};

export type FootballWeek = {
  weekStart: string;
  hasPublishedSession: boolean;
  appearances: number;
  goals: number;
};

export type RatingState = {
  activityScore: number;
  formScore: number;
  liveOvr: number;
  attributes: Attributes;
  rarityTier: RarityTier;
  lastWeekStart: string | null;
  goalsInMostRecentFootballWeek: number;
};

export const ARCHETYPE_OFFSETS: Record<Archetype, Attributes> = {
  all_rounder: { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 },
  speedster: { pac: 10, sho: -1, pas: -2, dri: 4, def: -6, phy: -5 },
  finisher: { pac: 2, sho: 10, pas: -3, dri: 3, def: -8, phy: -4 },
  playmaker: { pac: -2, sho: -2, pas: 10, dri: 5, def: -6, phy: -5 },
  defender: { pac: -2, sho: -7, pas: -1, dri: -4, def: 10, phy: 4 },
  tank: { pac: -8, sho: -2, pas: -2, dri: -4, def: 4, phy: 12 },
  // Shot-stopper: strong DEF/PHY, weak SHO/DRI. Sums to 0 like the other six
  // (BUILD_SPEC §589 — no large hidden OVR advantage). See ADR-036.
  goalkeeper: { pac: -6, sho: -12, pas: 0, dri: -8, def: 14, phy: 12 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rounded(value: number): number {
  return Math.round(value);
}

export function calculateActivityScore(
  previousActivityScore: number,
  appearances: number,
): number {
  const firstAppearanceBonus = appearances >= 1 ? GAME_CONFIG.activityFirstAppearance : 0;
  const secondAppearanceBonus =
    appearances >= 2 ? GAME_CONFIG.activitySecondAppearance : 0;

  return clamp(
    previousActivityScore * GAME_CONFIG.activityWeeklyDecay +
      firstAppearanceBonus +
      secondAppearanceBonus,
    0,
    100,
  );
}

export function calculateActivityOvr(activityScore: number): number {
  const boundedActivity = clamp(activityScore, 0, 100);

  return (
    GAME_CONFIG.activityOvrFloor +
    GAME_CONFIG.activityOvrRange *
      (boundedActivity / 100) ** GAME_CONFIG.activityOvrExponent
  );
}

export function calculateWeeklyPerformance(goals: number): number {
  const boundedGoals = Math.max(0, goals);
  const goalPoints =
    GAME_CONFIG.formGoalPoints * Math.min(boundedGoals, GAME_CONFIG.formGoalCap);
  const hatTrickBonus = boundedGoals >= 3 ? GAME_CONFIG.formHatTrickBonus : 0;

  return goalPoints + hatTrickBonus;
}

export type SessionFormContribution = {
  sessionInput: number;
  /** Number of later published v2 sessions at the snapshot being calculated. */
  age: number;
};

export function calculateGoalForm(goals: number | null): number {
  if (goals === null) return 0;
  if (!Number.isInteger(goals) || goals < 0 || goals > 99) {
    throw new Error("Goals must be an integer from 0 to 99.");
  }
  if (goals === 0) return 0;
  return goals === 1 ? 1 : goals === 2 ? 1.25 : 1.5;
}

export function calculateKudosForm(qualifiedCategories: number): number {
  if (!Number.isInteger(qualifiedCategories) || qualifiedCategories < 0 || qualifiedCategories > 3) {
    throw new Error("Qualified kudos categories must be from 0 to 3.");
  }
  if (qualifiedCategories === 0) return 0;
  return qualifiedCategories === 1 ? 1 : qualifiedCategories === 2 ? 1.25 : 1.5;
}

export function calculateSessionInput(goals: number | null, qualifiedCategories: number): number {
  return Math.min(3, calculateGoalForm(goals) + calculateKudosForm(qualifiedCategories));
}

export function calculateVersion2FormScore(
  contributions: SessionFormContribution[],
  legacyForm: number,
  publishedV2SessionCount: number,
): number {
  const weights = [1, 0.75, 0.5, 0.25] as const;
  const legacyWeights = [0, 0.75, 0.5, 0.25, 0] as const;
  const carry = clamp(legacyForm, 0, GAME_CONFIG.formCap) * (legacyWeights[Math.min(4, Math.max(0, publishedV2SessionCount))] ?? 0);
  const active = contributions.reduce((total, contribution) => {
    if (!Number.isFinite(contribution.sessionInput) || contribution.sessionInput < 0 || contribution.sessionInput > 3) {
      throw new Error("Session Form input must be from 0 to 3.");
    }
    return total + contribution.sessionInput * (weights[contribution.age] ?? 0);
  }, 0);
  return clamp(carry + active, 0, GAME_CONFIG.formCap);
}

export function calculateFormScore(previousFormScore: number, goals: number): number {
  return clamp(
    previousFormScore * GAME_CONFIG.formWeeklyDecay + calculateWeeklyPerformance(goals),
    0,
    GAME_CONFIG.formCap,
  );
}

export function calculateLiveOvr(activityOvr: number, formScore: number): number {
  return clamp(
    rounded(activityOvr + rounded(clamp(formScore, 0, GAME_CONFIG.formCap))),
    GAME_CONFIG.liveOvrMin,
    GAME_CONFIG.liveOvrMax,
  );
}

export function calculateAttributes(
  liveOvr: number,
  archetype: Archetype,
  goalsInMostRecentFootballWeek: number,
): Attributes {
  const offsets = ARCHETYPE_OFFSETS[archetype];
  const shootingBonus = Math.min(8, 2 * Math.max(0, goalsInMostRecentFootballWeek));

  return {
    pac: clamp(liveOvr + offsets.pac, 1, 99),
    sho: clamp(liveOvr + offsets.sho + shootingBonus, 1, 99),
    pas: clamp(liveOvr + offsets.pas, 1, 99),
    dri: clamp(liveOvr + offsets.dri, 1, 99),
    def: clamp(liveOvr + offsets.def, 1, 99),
    phy: clamp(liveOvr + offsets.phy, 1, 99),
  };
}

export function getRarityTier(liveOvr: number): RarityTier {
  if (liveOvr >= 80) return "elite";
  if (liveOvr >= 70) return "holo";
  if (liveOvr >= 60) return "gold";
  if (liveOvr >= 50) return "silver";
  if (liveOvr >= 40) return "bronze";
  return "common";
}

export function calculateLiveDiscardValue(liveOvr: number): number {
  return rounded(10 * 1.08 ** (liveOvr - GAME_CONFIG.liveOvrMin));
}

export function createInitialRatingState(archetype: Archetype): RatingState {
  const liveOvr = GAME_CONFIG.liveOvrMin;

  return {
    activityScore: 0,
    formScore: 0,
    liveOvr,
    attributes: calculateAttributes(liveOvr, archetype, 0),
    rarityTier: getRarityTier(liveOvr),
    lastWeekStart: null,
    goalsInMostRecentFootballWeek: 0,
  };
}

export function calculateRatingStateForWeek(
  previousState: RatingState,
  week: FootballWeek,
  archetype: Archetype,
): RatingState {
  if (!week.hasPublishedSession) return previousState;

  const activityScore = calculateActivityScore(previousState.activityScore, week.appearances);
  const formScore = calculateFormScore(previousState.formScore, week.goals);
  const liveOvr = calculateLiveOvr(calculateActivityOvr(activityScore), formScore);

  return {
    activityScore,
    formScore,
    liveOvr,
    attributes: calculateAttributes(liveOvr, archetype, week.goals),
    rarityTier: getRarityTier(liveOvr),
    lastWeekStart: week.weekStart,
    goalsInMostRecentFootballWeek: Math.max(0, week.goals),
  };
}

export function rebuildRatingState(
  weeks: FootballWeek[],
  archetype: Archetype,
): RatingState {
  return [...weeks]
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
    .reduce(
      (state, week) => calculateRatingStateForWeek(state, week, archetype),
      createInitialRatingState(archetype),
    );
}
