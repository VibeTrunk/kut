import type { Archetype } from "@/game/archetypes";
import type { MatchOutcome, Side } from "@/game/midweek/match";

/**
 * What the report renderer needs about one card: its name and the week-long
 * factors the engine froze at the lock (BUILD_SPEC §44.3). The pages build this
 * from the stored entries; the renderer never reads the database.
 */
export type ReportCard = {
  /** Display name; null for a trialist. */
  name: string | null;
  trialist: boolean;
  injured: boolean;
  ovr: number;
  archetype: Archetype;
  ovrFactorPpm: number;
  formRollPpm: number;
  pickFactorPpm: number;
  fitnessPpm: number;
  handicapPpm: number;
  powerPpm: number;
  /** Entrants who picked this Player (auto squads excluded); null for a trialist. */
  picks: number | null;
  /** Entrants who own the Player, or null below three owners (ADR-091) or for a trialist. */
  owners: number | null;
};

export type ReportSide = {
  /** The manager: the entrant's display name. */
  manager: string;
  auto: boolean;
  keeperSlot: number;
  keeperless: boolean;
  cards: readonly ReportCard[];
};

export type ReportInput = {
  /** The tournament's published seed hash; phrase choice is keyed on it, never on the secret seed. */
  seedHash: string;
  round: number;
  rounds: number;
  pairing: number;
  sides: readonly [ReportSide, ReportSide];
  outcome: MatchOutcome;
};

export type MomentKind = "goal" | "save" | "block" | "woodwork" | "wide";

export type TimelineItem = {
  minute: number;
  side: Side;
  kind: MomentKind;
  text: string;
  /** The running score after this moment, side 0 first. */
  score: [number, number];
};

export type ShootoutKick = {
  side: Side;
  round: number;
  kicker: string;
  outcome: "goal" | "save" | "woodwork" | "wide";
};

export type ShootoutReport = {
  firstSide: Side;
  kicks: ShootoutKick[];
  score: [number, number];
  /** Intro, each kick not scored, and the decisive kick or draw. */
  lines: string[];
};

export type WhyCard = {
  name: string;
  trialist: boolean;
  injured: boolean;
  inGoal: boolean;
  ovr: number;
  archetype: Archetype;
  ovrFactorPpm: number;
  formRollPpm: number;
  pickFactorPpm: number;
  fitnessPpm: number;
  handicapPpm: number;
  powerPpm: number;
  dayRollPpm: number;
  /** "3 of 7 owners", "a rare pick", "auto squad", or null for a trialist. */
  pickLabel: string | null;
  goals: number;
  assists: number;
};

export type WhySide = {
  manager: string;
  auto: boolean;
  keeperless: boolean;
  winChancePpm: number;
  cards: WhyCard[];
};

export type ReportFact = { kind: string; text: string };

/** Which phrasebook line produced which part of the report, for review and tests. */
export type PhraseUse = { layer: string; template: string };

export type MatchReport = {
  headline: string;
  /** The final score, winner first, with penalties when they decided it. */
  score: string;
  winnerSide: Side;
  facts: ReportFact[];
  timeline: TimelineItem[];
  shootout: ShootoutReport | null;
  why: [WhySide, WhySide];
  phrases: PhraseUse[];
};
