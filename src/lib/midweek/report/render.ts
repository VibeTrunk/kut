import { MIDWEEK, PPM } from "@/game/midweek/config";
import type { ChanceEvent, PenaltyEvent, Side } from "@/game/midweek/match";
import { shaRng, uniform, type Rng } from "@/game/midweek/rng";
import { squadBalance } from "@/game/midweek/shape";
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
  ReportSide,
  Segment,
  ShootoutReport,
  ShortLine,
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

/** A rendered line, as plain text and as segments (HANDOFF "PlayerName"). */
export type Styled = { text: string; parts: Segment[] };

/** A name as plain text: the base name, with the manager when both sides fielded the Player. */
export const nameText = (segment: Segment) =>
  segment.owner === undefined ? segment.text : `${segment.text} (${segment.owner})`;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Fills a phrasebook line. Values are plain strings or name segments; the text
 * form spells each name out with `nameText`, the segment form keeps it whole
 * with its side. Display names often end in an initial ("Iris W."), so a name
 * at the end of a sentence would leave a double full stop: the text drops one,
 * and the segments drop the sentence's own, since a page shows "Kees R. (Bart)."
 * as "Kees R." with the manager for screen readers only.
 */
export function compose(template: string, values: Record<string, string | Segment>): Styled {
  const raw: Segment[] = [];
  let last = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const value = values[match[1]];
    if (value === undefined) throw new Error(`No value for {${match[1]}} in "${template}"`);
    raw.push({ text: template.slice(last, match.index) });
    raw.push(typeof value === "string" ? { text: value } : value);
    last = match.index + match[0].length;
  }
  raw.push({ text: template.slice(last) });

  const text = capitalise(raw.map(nameText).join("").replace(/\.\./g, "."));

  // Plain runs merge first, so a tidy across a value's edge matches the text's.
  const merged: Segment[] = [];
  for (const segment of raw) {
    const previous = merged[merged.length - 1];
    if (segment.side === undefined && previous && previous.side === undefined) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  const parts: Segment[] = [];
  for (const segment of merged) {
    if (segment.side !== undefined) {
      parts.push(segment);
      continue;
    }
    let plain = segment.text.replace(/\.\./g, ".");
    const previous = parts[parts.length - 1];
    if (previous?.side !== undefined && previous.text.endsWith(".") && plain.startsWith(".")) {
      plain = plain.slice(1);
    }
    if (plain) parts.push({ text: plain });
  }
  if (parts.length > 0) parts[0] = { ...parts[0], text: capitalise(parts[0].text) };
  return { text, parts };
}

export function fill(template: string, values: Record<string, string | Segment>): string {
  return compose(template, values).text;
}

/** Lines joined by a space, as one moment's build-up, finish and aside. */
function joinStyled(lines: readonly Styled[]): Styled {
  return {
    text: lines.map((line) => line.text).join(" "),
    parts: lines.flatMap((line, index) =>
      index === 0 ? line.parts : [{ text: " " }, ...line.parts],
    ),
  };
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/**
 * Display names per side, as name segments. Trialists are the manager's,
 * numbered when there is more than one; a Player fielded by both sides carries
 * the manager as its `owner`, which the text spells out as "Iris W. (Sanne)".
 */
function sideNames(input: ReportInput): [Segment[], Segment[]] {
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
    names.map((name, slot): Segment =>
      shared.has(name) && input.sides[s].cards[slot].name !== null
        ? { text: name, side: s as Side, owner: input.sides[s].manager }
        : { text: name, side: s as Side },
    ),
  ) as [Segment[], Segment[]];
}

/** A manager's name as a segment on their side. */
const managerOf = (input: ReportInput, side: Side): Segment => ({
  text: input.sides[side].manager,
  side,
});

/**
 * The label for a Player too few entrants own to print a count (ADR-091). It
 * names the card's scarcity, not the pick: every owner may have picked it.
 */
export const FEW_OWNERS_LABEL = `fewer than ${MIDWEEK.ownerCountMin} owners`;

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
  return card.owners === null ? FEW_OWNERS_LABEL : `${card.picks ?? 0} of ${card.owners} owners`;
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

const LINE_NAMES = ["Attack", "Midfield", "Defence"] as const;

/**
 * The lines a squad fell short in (ADR-116), from its archetypes and keeper,
 * only when the stored balance says the rule cost it something: a week from
 * before the rule (null) shows none.
 */
export function shortLines(side: ReportSide): ShortLine[] {
  if (side.balancePpm === null || side.balancePpm >= PPM) return [];
  const { short } = squadBalance(
    side.cards.map((card) => card.archetype),
    side.keeperSlot,
  );
  return LINE_NAMES.flatMap((line, i) => (short[i] > 0 ? [{ line, short: short[i] }] : []));
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
    const values: Record<string, string | Segment> = {
      creator: names[event.side][event.creator],
      shooter: names[event.side][event.shooter],
      keeper: names[opp][sides[opp].keeperSlot],
      defender: event.defender === null ? "" : names[opp][event.defender],
    };
    const parts: Styled[] = [];
    const solo = event.creator === event.shooter;
    const buildPool = solo ? SOLO_BUILDUP[event.chanceType] : BUILDUP[event.chanceType];
    if (buildPool) {
      parts.push(
        compose(
          picker.pick(solo ? `solo:${event.chanceType}` : `buildup:${event.chanceType}`, buildPool),
          values,
        ),
      );
    }

    let kind: MomentKind = event.outcome;
    if (event.outcome === "goal") {
      const tier = goalTier(event.pGoalPpm);
      parts.push(
        compose(
          picker.pick(`finish:${event.chanceType}:${tier}`, FINISHES[event.chanceType][tier]),
          values,
        ),
      );
      if (attacking.cards[event.shooter].injured) {
        parts.push(compose(picker.pick(`injured-goal:${tier}`, INJURED_GOAL[tier]), values));
      } else if (!solo && attacking.cards[event.creator].injured) {
        parts.push(compose(picker.pick("injured-creator", INJURED_CREATOR), values));
      }
    } else if (event.outcome === "save") {
      const tier = saveTier(event.pGoalPpm);
      parts.push(compose(picker.pick(`save:${tier}`, SAVES[tier]), values));
      if (sides[opp].cards[sides[opp].keeperSlot].injured) {
        parts.push(compose(picker.pick("injured-keeper", INJURED_KEEPER), values));
      }
    } else if (event.outcome === "block") {
      parts.push(compose(picker.pick("block", BLOCKS), values));
    } else if (event.outcome === "woodwork") {
      parts.push(compose(picker.pick("woodwork", WOODWORK), values));
    } else {
      kind = "wide";
      parts.push(compose(picker.pick("wide", WIDE), values));
    }
    const line = joinStyled(parts);
    return {
      minute: event.minute,
      side: event.side,
      kind,
      text: line.text,
      parts: line.parts,
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
    shortLines: shortLines(side),
    winChancePpm: s === 0 ? outcome.winChancePpm : PPM - outcome.winChancePpm,
    cards: side.cards.map((card, slot) => ({
      name: nameText(names[s][slot]),
      label: names[s][slot],
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
    headline: headline.text,
    headlineParts: headline.parts,
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
  names: [Segment[], Segment[]],
  picker: Picker,
): ShootoutReport {
  const { outcome } = input;
  const kicks = outcome.events.filter((e): e is PenaltyEvent => e.kind === "penalty");
  const toss = outcome.events.find((e) => e.kind === "toss");
  const firstSide = kicks[0].side;
  const secondSide: Side = firstSide === 0 ? 1 : 0;
  const lines: Styled[] = [
    compose(picker.pick("shootout-intro", SHOOTOUT_INTRO), {
      first: managerOf(input, firstSide),
      second: managerOf(input, secondSide),
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
      lines.push(compose(picker.pick(`penalty-decisive:${kick.outcome}`, pool), values));
    } else if (kick.outcome !== "goal") {
      const pool =
        kick.outcome === "save"
          ? PENALTY_SAVED
          : kick.outcome === "woodwork"
            ? PENALTY_WOODWORK
            : PENALTY_WIDE;
      lines.push(compose(picker.pick(`penalty:${kick.outcome}`, pool), values));
    }
  });
  if (toss) {
    lines.push(
      compose(picker.pick("shootout-toss", SHOOTOUT_TOSS), {
        winner: managerOf(input, outcome.winnerSide),
      }),
    );
  }
  return {
    firstSide,
    kicks: kicks.map((kick) => ({
      side: kick.side,
      round: kick.round,
      kicker: nameText(names[kick.side][kick.kicker]),
      outcome: kick.outcome,
    })),
    score: outcome.penalties!,
    lines: lines.map((line) => line.text),
    lineParts: lines.map((line) => line.parts),
  };
}

function renderHeadline(
  input: ReportInput,
  facts: readonly Fact[],
  names: [Segment[], Segment[]],
  score: string,
  picker: Picker,
  stats: ReturnType<typeof cardStats>,
): Styled {
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

  return compose(picker.pick(`headline:${kind}`, HEADLINES[kind]), {
    winner: managerOf(input, winner),
    loser: managerOf(input, loser),
    score,
    hero: names[winner][hero],
  });
}

function renderFacts(
  input: ReportInput,
  facts: readonly Fact[],
  names: [Segment[], Segment[]],
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
    let lineKind: FactLineKind;
    const values: Record<string, string | Segment> = {
      manager: managerOf(input, fact.side),
      opponent: managerOf(input, fact.side === 0 ? 1 : 0),
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
    const line = compose(picker.pick(`fact:${lineKind}`, FACT_LINES[lineKind]), values);
    lines.push({ kind: fact.kind, text: line.text, parts: line.parts });
  }
  return lines;
}
