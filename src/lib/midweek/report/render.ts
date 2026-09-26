import { PPM } from "@/game/midweek/config";
import type { ChanceEvent, PenaltyEvent, Side } from "@/game/midweek/match";
import { shaRng, uniform, type Rng } from "@/game/midweek/rng";
import { cardStats, detectFacts, type Fact } from "./facts";
import { BUILDUP, SOLO_BUILDUP } from "./phrasebook/buildup";
import { FINISHES, type Tier } from "./phrasebook/finishes";
import {
  FACT_LINES,
  HEADLINES,
  type FactLineKind,
  type HeadlineKind,
} from "./phrasebook/headlines";
import {
  BLOCKS,
  INJURED_CREATOR,
  INJURED_GOAL,
  INJURED_KEEPER,
  SAVES,
  WIDE,
  WOODWORK,
} from "./phrasebook/moments";
import {
  DECISIVE_MISSED,
  DECISIVE_SAVED,
  DECISIVE_SCORED,
  PENALTY_SAVED,
  PENALTY_WIDE,
  PENALTY_WOODWORK,
  SHOOTOUT_INTRO,
  SHOOTOUT_TOSS,
} from "./phrasebook/penalties";
import type {
  MatchReport,
  MomentKind,
  PhraseUse,
  ReportCard,
  ReportFact,
  ReportInput,
  ShootoutReport,
  TimelineItem,
  WhySide,
} from "./types";

/**
 * Renders one match report (BUILD_SPEC §44.10): a headline, facts, a timeline
 * of key moments and a "why" panel. Presentation only: it decides nothing, so
 * it has no SQL twin (ADR-093). It is a pure function of the stored match and
 * the published seed hash, so a report reads the same on every visit.
 */

/** A goal from a chance the engine gave less than this is sensational; at least `ROUTINE_FROM` is routine. */
export const SENSATIONAL_BELOW_PPM = 150_000;
export const ROUTINE_FROM_PPM = 350_000;
/** Timeline length: every goal, topped up with the biggest other chances to between these. */
export const TIMELINE_MIN = 4;
export const TIMELINE_MAX = 8;
export const MAX_FACTS = 3;

export function goalTier(pGoalPpm: number): Tier {
  if (pGoalPpm < SENSATIONAL_BELOW_PPM) return "sensational";
  if (pGoalPpm < ROUTINE_FROM_PPM) return "quality";
  return "routine";
}

/** A save's tier: the bigger the chance it denied, the bigger the save. */
export function saveTier(pGoalPpm: number): "great" | "good" | "routine" {
  if (pGoalPpm >= ROUTINE_FROM_PPM) return "great";
  if (pGoalPpm >= SENSATIONAL_BELOW_PPM) return "good";
  return "routine";
}

/** Seeded choice without repeats within one report. */
class Picker {
  private readonly rng: Rng;
  private count = 0;
  private readonly used = new Set<string>();
  readonly uses: PhraseUse[] = [];

  constructor(
    seedHash: string,
    private readonly prefix: string,
  ) {
    this.rng = shaRng(seedHash);
  }

  pick(layer: string, pool: readonly string[]): string {
    if (pool.length === 0) throw new Error(`Empty phrase pool: ${layer}`);
    const fresh = pool.filter((template) => !this.used.has(template));
    const candidates = fresh.length > 0 ? fresh : pool;
    const template =
      candidates[uniform(this.rng, `${this.prefix}:${this.count}`, candidates.length)];
    this.count += 1;
    this.used.add(template);
    this.uses.push({ layer, template });
    return template;
  }
}

export function fill(template: string, values: Record<string, string>): string {
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`No value for {${key}} in "${template}"`);
    return value;
  });
  // Display names often end in an initial ("Iris W."), so a name at the end of a
  // sentence would otherwise leave a double full stop.
  const tidy = text.replace(/\.\./g, ".");
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/**
 * Display names per side. Trialists are the manager's, numbered when there is
 * more than one; a Player fielded by both sides gets the manager's name added.
 */
function sideNames(input: ReportInput): [string[], string[]] {
  const raw = input.sides.map((side) => {
    const trialists = side.cards.filter((card) => card.name === null).length;
    let seen = 0;
    return side.cards.map((card) => {
      if (card.name !== null) return card.name;
      const ordinal = trialists > 1 ? `${ORDINALS[seen]} ` : "";
      seen += 1;
      return `${side.manager}'s ${ordinal}trialist`;
    });
  });
  const shared = new Set(raw[0].filter((name) => raw[1].includes(name)));
  return raw.map((names, s) =>
    names.map((name, slot) =>
      shared.has(name) && input.sides[s].cards[slot].name !== null
        ? `${name} (${input.sides[s].manager})`
        : name,
    ),
  ) as [string[], string[]];
}

/**
 * The "why" panel's pick label. Owner counts appear only once published (D3)
 * and only at three owners or more (ADR-091); an auto squad's picks were never
 * the member's choice (ADR-093).
 */
export function pickLabel(
  card: ReportCard,
  auto: boolean,
  ownersPublished: boolean,
): string | null {
  if (card.trialist) return null;
  if (auto) return "auto squad";
  if (!ownersPublished) return null;
  return card.owners === null ? "a rare pick" : `${card.picks ?? 0} of ${card.owners} owners`;
}

const percent = (ppm: number) => `${Math.round(ppm / (PPM / 100))}%`;
const twoDecimals = (ppm: number) => (ppm / PPM).toFixed(2);

function selectMoments(events: readonly ChanceEvent[]): ChanceEvent[] {
  const goals = events.filter((e) => e.outcome === "goal");
  if (goals.length >= TIMELINE_MAX) return goals;
  const target = Math.min(TIMELINE_MAX, Math.max(TIMELINE_MIN, goals.length + 2));
  const others = events
    .filter((e) => e.outcome !== "goal")
    .sort((a, b) => b.pGoalPpm - a.pGoalPpm || a.minute - b.minute)
    .slice(0, target - goals.length);
  return [...goals, ...others].sort((a, b) => a.minute - b.minute);
}

export function renderMatchReport(input: ReportInput): MatchReport {
  const { outcome, sides } = input;
  const picker = new Picker(input.seedHash, `report:${input.round}:${input.pairing}`);
  const names = sideNames(input);
  const winner = outcome.winnerSide;
  const loser: Side = winner === 0 ? 1 : 0;
  const stats = cardStats(input);
  const chances = outcome.events.filter((e): e is ChanceEvent => e.kind === "chance");

  // Running score after each chance.
  const running = new Map<ChanceEvent, [number, number]>();
  const tally: [number, number] = [0, 0];
  for (const event of chances) {
    if (event.outcome === "goal") tally[event.side] += 1;
    running.set(event, [tally[0], tally[1]]);
  }

  const timeline: TimelineItem[] = selectMoments(chances).map((event) => {
    const attacking = sides[event.side];
    const opp: Side = event.side === 0 ? 1 : 0;
    const values: Record<string, string> = {
      creator: names[event.side][event.creator],
      shooter: names[event.side][event.shooter],
      keeper: names[opp][sides[opp].keeperSlot],
      defender: event.defender === null ? "" : names[opp][event.defender],
    };
    const parts: string[] = [];
    const solo = event.creator === event.shooter;
    const buildPool = solo ? SOLO_BUILDUP[event.chanceType] : BUILDUP[event.chanceType];
    if (buildPool) {
      parts.push(
        fill(
          picker.pick(solo ? `solo:${event.chanceType}` : `buildup:${event.chanceType}`, buildPool),
          values,
        ),
      );
    }

    let kind: MomentKind = event.outcome;
    if (event.outcome === "goal") {
      const tier = goalTier(event.pGoalPpm);
      parts.push(
        fill(
          picker.pick(`finish:${event.chanceType}:${tier}`, FINISHES[event.chanceType][tier]),
          values,
        ),
      );
      if (attacking.cards[event.shooter].injured) {
        parts.push(fill(picker.pick(`injured-goal:${tier}`, INJURED_GOAL[tier]), values));
      } else if (!solo && attacking.cards[event.creator].injured) {
        parts.push(fill(picker.pick("injured-creator", INJURED_CREATOR), values));
      }
    } else if (event.outcome === "save") {
      const tier = saveTier(event.pGoalPpm);
      parts.push(fill(picker.pick(`save:${tier}`, SAVES[tier]), values));
      if (sides[opp].cards[sides[opp].keeperSlot].injured) {
        parts.push(fill(picker.pick("injured-keeper", INJURED_KEEPER), values));
      }
    } else if (event.outcome === "block") {
      parts.push(fill(picker.pick("block", BLOCKS), values));
    } else if (event.outcome === "woodwork") {
      parts.push(fill(picker.pick("woodwork", WOODWORK), values));
    } else {
      kind = "wide";
      parts.push(fill(picker.pick("wide", WIDE), values));
    }
    return {
      minute: event.minute,
      side: event.side,
      kind,
      text: parts.join(" "),
      score: running.get(event)!,
    };
  });

  const shootout = outcome.penalties ? renderShootout(input, names, picker) : null;

  const [gw, gl] = [outcome.goals[winner], outcome.goals[loser]];
  const score =
    `${gw}–${gl}` +
    (outcome.penalties
      ? ` (${outcome.penalties[winner]}–${outcome.penalties[loser]} on penalties)`
      : "");

  const facts = detectFacts(input);
  const headline = renderHeadline(input, facts, names, score, picker, stats);
  const reportFacts = renderFacts(input, facts, names, picker);

  const why = sides.map((side, s): WhySide => ({
    manager: side.manager,
    auto: side.auto,
    keeperless: side.keeperless,
    winChancePpm: s === 0 ? outcome.winChancePpm : PPM - outcome.winChancePpm,
    cards: side.cards.map((card, slot) => ({
      name: names[s][slot],
      trialist: card.trialist,
      injured: card.injured,
      inGoal: slot === side.keeperSlot,
      ovr: card.ovr,
      archetype: card.archetype,
      ovrFactorPpm: card.ovrFactorPpm,
      formRollPpm: card.formRollPpm,
      pickFactorPpm: card.pickFactorPpm,
      fitnessPpm: card.fitnessPpm,
      handicapPpm: card.handicapPpm,
      powerPpm: card.powerPpm,
      dayRollPpm: outcome.dayRollsPpm[s][slot],
      pickLabel: pickLabel(card, side.auto, input.ownersPublished),
      goals: stats[s][slot].goals,
      assists: stats[s][slot].assists,
    })),
  })) as [WhySide, WhySide];

  return {
    headline,
    score,
    winnerSide: winner,
    facts: reportFacts,
    timeline,
    shootout,
    why,
    phrases: picker.uses,
  };
}

function renderShootout(
  input: ReportInput,
  names: [string[], string[]],
  picker: Picker,
): ShootoutReport {
  const { outcome, sides } = input;
  const kicks = outcome.events.filter((e): e is PenaltyEvent => e.kind === "penalty");
  const toss = outcome.events.find((e) => e.kind === "toss");
  const firstSide = kicks[0].side;
  const secondSide: Side = firstSide === 0 ? 1 : 0;
  const lines = [
    fill(picker.pick("shootout-intro", SHOOTOUT_INTRO), {
      first: sides[firstSide].manager,
      second: sides[secondSide].manager,
    }),
  ];
  kicks.forEach((kick, index) => {
    const opp: Side = kick.side === 0 ? 1 : 0;
    const values = { kicker: names[kick.side][kick.kicker], keeper: names[opp][kick.keeper] };
    const decisive = !toss && index === kicks.length - 1;
    if (decisive) {
      const pool =
        kick.outcome === "goal"
          ? DECISIVE_SCORED
          : kick.outcome === "save"
            ? DECISIVE_SAVED
            : DECISIVE_MISSED;
      lines.push(fill(picker.pick(`penalty-decisive:${kick.outcome}`, pool), values));
    } else if (kick.outcome !== "goal") {
      const pool =
        kick.outcome === "save"
          ? PENALTY_SAVED
          : kick.outcome === "woodwork"
            ? PENALTY_WOODWORK
            : PENALTY_WIDE;
      lines.push(fill(picker.pick(`penalty:${kick.outcome}`, pool), values));
    }
  });
  if (toss) {
    lines.push(
      fill(picker.pick("shootout-toss", SHOOTOUT_TOSS), {
        winner: sides[outcome.winnerSide].manager,
      }),
    );
  }
  return {
    firstSide,
    kicks: kicks.map((kick) => ({
      side: kick.side,
      round: kick.round,
      kicker: names[kick.side][kick.kicker],
      outcome: kick.outcome,
    })),
    score: outcome.penalties!,
    lines,
  };
}

function renderHeadline(
  input: ReportInput,
  facts: readonly Fact[],
  names: [string[], string[]],
  score: string,
  picker: Picker,
  stats: ReturnType<typeof cardStats>,
): string {
  const { outcome, sides } = input;
  const winner = outcome.winnerSide;
  const loser: Side = winner === 0 ? 1 : 0;
  const margin = outcome.goals[winner] - outcome.goals[loser];
  const has = (kind: Fact["kind"], side?: Side) =>
    facts.find((f) => f.kind === kind && (side === undefined || f.side === side));

  // The winner's top scorer, the standout breaking ties.
  let hero = 0;
  stats[winner].forEach((card, slot) => {
    const best = stats[winner][hero];
    if (card.goals > best.goals || (card.goals === best.goals && card.standout > best.standout))
      hero = slot;
  });

  const goals = outcome.events.filter(
    (e): e is ChanceEvent => e.kind === "chance" && e.outcome === "goal",
  );
  let trailed = false;
  const tally: [number, number] = [0, 0];
  let lastGoal: ChanceEvent | null = null;
  let lastBrokeTie = false;
  for (const goal of goals) {
    const wasLevel = tally[0] === tally[1];
    tally[goal.side] += 1;
    if (tally[loser] > tally[winner]) trailed = true;
    lastGoal = goal;
    lastBrokeTie = wasLevel;
  }

  let kind: HeadlineKind;
  const hatTrick = has("hat_trick", winner);
  if (hatTrick) {
    kind = "hat_trick";
    hero = hatTrick.slot!;
  } else if (has("upset")) kind = "upset";
  else if (margin >= 3) kind = "thrashing";
  else if (has("three_keeper_gamble", winner)) kind = "three_keeper_win";
  else if (has("three_keeper_gamble", loser)) kind = "three_keeper_loss";
  else if (outcome.penalties) kind = "shootout";
  else if (trailed) kind = "comeback";
  else if (
    margin === 1 &&
    lastGoal &&
    lastGoal.side === winner &&
    lastGoal.minute >= 80 &&
    lastBrokeTie
  ) {
    kind = "late_winner";
    hero = lastGoal.shooter;
  } else if (sides[winner].keeperless && !sides[loser].keeperless) kind = "keeperless_win";
  else if (sides[loser].keeperless && !sides[winner].keeperless) kind = "keeperless_loss";
  else if (margin >= 2) kind = "comfortable";
  else kind = "narrow";

  return fill(picker.pick(`headline:${kind}`, HEADLINES[kind]), {
    winner: sides[winner].manager,
    loser: sides[loser].manager,
    score,
    hero: names[winner][hero],
  });
}

function renderFacts(
  input: ReportInput,
  facts: readonly Fact[],
  names: [string[], string[]],
  picker: Picker,
): ReportFact[] {
  const lines: ReportFact[] = [];
  const mentioned = new Set<string>();
  for (const fact of facts) {
    if (lines.length >= MAX_FACTS) break;
    const key = fact.slot === null ? `${fact.kind}:${fact.side}` : `${fact.side}:${fact.slot}`;
    if (mentioned.has(key)) continue;
    mentioned.add(key);

    const side = input.sides[fact.side];
    const card = fact.slot === null ? null : side.cards[fact.slot];
    const opponent = input.sides[fact.side === 0 ? 1 : 0].manager;
    let lineKind: FactLineKind;
    const values: Record<string, string> = {
      manager: side.manager,
      opponent,
      name: fact.slot === null ? "" : names[fact.side][fact.slot],
      value: "",
      picks: "",
      owners: "",
      tier: "",
    };
    switch (fact.kind) {
      case "contrarian_hero":
        if (!input.ownersPublished) {
          lineKind = "contrarian_unpublished";
        } else if (card!.owners !== null && card!.picks !== null) {
          lineKind = "contrarian_known";
          values.picks = String(card!.picks);
          values.owners = String(card!.owners);
        } else {
          lineKind = "contrarian_rare";
        }
        break;
      case "form_hero":
        lineKind = "form_hero";
        values.value = twoDecimals(fact.value!);
        break;
      case "cheap_standout":
        lineKind = "cheap_standout";
        values.tier = card!.ovr < 40 ? "Common" : "Bronze";
        break;
      case "upset":
        lineKind = "upset";
        values.value = percent(fact.value!);
        break;
      case "three_keeper_gamble":
        lineKind = fact.value === 1 ? "three_keeper_paid" : "three_keeper_backfired";
        break;
      case "thrashing":
        lineKind = "thrashing";
        values.value = String(fact.value);
        break;
      default:
        lineKind = fact.kind;
    }
    lines.push({
      kind: fact.kind,
      text: fill(picker.pick(`fact:${lineKind}`, FACT_LINES[lineKind]), values),
    });
  }
  return lines;
}
