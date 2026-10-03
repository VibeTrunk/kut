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
  /** The weakest-line factor the squad played with (ADR-116); null for a week before the rule. */
  balancePpm: number | null;
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
  /**
   * Whether owner counts may be printed (owner decision D3: only once the week
   * is complete). When false, no card carries an owner label and the
   * contrarian-hero fact uses a count-free line, so nothing reads "a rare pick"
   * merely because the counts are still withheld.
   */
  ownersPublished: boolean;
};

/**
 * A run of report text (HANDOFF "PlayerName"): plain, or a name with its side,
 * so a page can colour every Player and manager without re-parsing the text.
 * A name carries the base display name only; `owner` is the manager whose copy
 * it is when both sides fielded the Player, which the plain `text` fields spell
 * out as "Iris W. (Sanne)" and a page keeps for screen readers.
 */
export type Segment = { text: string; side?: Side; owner?: string };

export type MomentKind = "goal" | "save" | "block" | "woodwork" | "wide";

export type TimelineItem = {
  minute: number;
  side: Side;
  kind: MomentKind;
  text: string;
  /** `text` as segments. */
  parts: Segment[];
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
  /** `lines` as segments. */
  lineParts: Segment[][];
};

export type WhyCard = {
  name: string;
  /** `name` as one name segment: the base name, with `owner` when both sides fielded the Player. */
  label: Segment;
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
  /**
   * "3 of 7 owners", "fewer than 3 owners", "auto squad", or null for a trialist and,
   * until owner counts are published, for every picked card.
   */
  pickLabel: string | null;
  goals: number;
  assists: number;
};

/** An outfield line that fell short of the weakest-line rule, and by how many plusses (ADR-116). */
export type ShortLine = { line: "Attack" | "Midfield" | "Defence"; short: number };

export type WhySide = {
  manager: string;
  auto: boolean;
  keeperless: boolean;
  /** Empty when no line fell short, and for a week before the rule. */
  shortLines: ShortLine[];
  winChancePpm: number;
  cards: WhyCard[];
};

export type ReportFact = { kind: string; text: string; parts: Segment[] };

/** Which phrasebook line produced which part of the report, for review and tests. */
export type PhraseUse = { layer: string; template: string };

export type MatchReport = {
  headline: string;
  /** `headline` as segments. */
  headlineParts: Segment[];
  /** The final score, winner first, with penalties when they decided it. */
  score: string;
  winnerSide: Side;
  facts: ReportFact[];
  timeline: TimelineItem[];
  shootout: ShootoutReport | null;
  why: [WhySide, WhySide];
  phrases: PhraseUse[];
};
