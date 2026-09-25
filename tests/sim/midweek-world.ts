import type { Archetype } from "@/game/archetypes";
import { MIDWEEK, PPM, type MidweekConfig } from "@/game/midweek/config";
import { mulPpm } from "@/game/midweek/fixed";
import { playMatch, sideRatingPpm, type MatchOutcome } from "@/game/midweek/match";
import { ovrFactorPpm } from "@/game/midweek/power";
import type { Rng } from "@/game/midweek/rng";
import {
  buildField,
  simulateTournament,
  toMatchSide,
  type EngineCard,
  type EntrantInput,
  type Entry,
  type SimulatedTournament,
} from "@/game/midweek/tournament";

/**
 * The Midweek Madness simulation harness (BUILD_SPEC §44.12, ADR-090).
 *
 * It generates KUT-shaped rosters and collections, lets a mix of simulated
 * managers pick squads week after week, runs the real engine, and measures the
 * targets. The engine runs on a fast tag-hashing generator instead of sha256:
 * the distribution is the same, and because draws are still keyed by tag, a
 * counterfactual squad in the same week sees the same form rolls.
 */

// --- randomness -----------------------------------------------------------

/** cyrb53: a fast, well-mixed 53-bit string hash. Simulation only. */
function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function fastRng(seed: number): Rng {
  const DRAW_SPACE = 2 ** 48;
  return (tag) => cyrb53(tag, seed) % DRAW_SPACE;
}

/** mulberry32, for generating the world itself. */
function worldRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- the world ------------------------------------------------------------

type Player = { playerId: string; ovr: number; archetype: Archetype };

export type Member = { userId: string; owned: EngineCard[]; strength: number };

export const HABITS = ["top_ovr", "contrarian", "last_winners", "random"] as const;
export type Habit = (typeof HABITS)[number];
export type Strategy = Habit | "thoughtful" | "auto";

const TIERS = [
  { min: 30, max: 39, rosterWeight: 8, packWeight: 100 },
  { min: 40, max: 49, rosterWeight: 7, packWeight: 60 },
  { min: 50, max: 59, rosterWeight: 6, packWeight: 30 },
  { min: 60, max: 69, rosterWeight: 5, packWeight: 12 },
  { min: 70, max: 79, rosterWeight: 3, packWeight: 4 },
  { min: 80, max: 83, rosterWeight: 1, packWeight: 1 },
];

function tierOf(ovr: number) {
  return TIERS.find((tier) => ovr >= tier.min && ovr <= tier.max)!;
}

function weightedIndex(random: () => number, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let target = random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    if (target < weights[i]) return i;
    target -= weights[i];
  }
  return weights.length - 1;
}

export type WorldOptions = { rosterSize: number; members: number; maxPacks: number };

export const DEFAULT_WORLD: WorldOptions = { rosterSize: 30, members: 22, maxPacks: 40 };

/**
 * A roster shaped like KUT's: most Players low-rated, about 80% All-rounders,
 * two Goalkeepers. Collections come from a starter pack plus a skewed number
 * of packs, each card drawn with the pack's rarity weights.
 */
export function generateWorld(seed: number, options: WorldOptions = DEFAULT_WORLD) {
  const random = worldRandom(seed);
  const specialists: Archetype[] = [
    "goalkeeper",
    "goalkeeper",
    "speedster",
    "finisher",
    "playmaker",
    "defender",
    "tank",
  ];
  const players: Player[] = [];
  for (let i = 0; i < options.rosterSize; i += 1) {
    const tier =
      TIERS[
        weightedIndex(
          random,
          TIERS.map((t) => t.rosterWeight),
        )
      ];
    const ovr = tier.min + Math.floor(random() * (tier.max - tier.min + 1));
    players.push({ playerId: `p${String(i).padStart(2, "0")}`, ovr, archetype: "all_rounder" });
  }
  // Specialists land on random Players, so their ratings are spread like everyone's.
  const order = players.map((_, i) => i).sort(() => random() - 0.5);
  specialists.forEach((archetype, i) => {
    players[order[i]].archetype = archetype;
  });

  const packWeights = players.map((p) => tierOf(p.ovr).packWeight);
  const members: Member[] = [];
  for (let m = 0; m < options.members; m += 1) {
    const userId = `u${String(m).padStart(2, "0")}`;
    const packs = Math.floor(options.maxPacks * random() ** 2);
    const owned: EngineCard[] = [];
    for (let c = 0; c < 3 + packs * 3; c += 1) {
      const player = players[weightedIndex(random, packWeights)];
      owned.push({
        cardId: `${userId}-c${c}`,
        playerId: player.playerId,
        ovr: player.ovr,
        archetype: player.archetype,
        injured: false,
      });
    }
    members.push({ userId, owned, strength: collectionStrength(owned) });
  }
  return { players, members, random };
}

/** Mean OVR of the five best distinct Players, with trialists at 30 for gaps. */
export function collectionStrength(owned: readonly EngineCard[]): number {
  const best = new Map<string, number>();
  for (const card of owned)
    best.set(card.playerId, Math.max(best.get(card.playerId) ?? 0, card.ovr));
  const top = [...best.values()].sort((a, b) => b - a).slice(0, 5);
  while (top.length < 5) top.push(30);
  return top.reduce((sum, v) => sum + v, 0) / 5;
}

// --- managers -------------------------------------------------------------

type Published = {
  shares: Map<string, { picks: number; owners: number }>;
  finalistPlayers: Set<string>;
};

function distinctCards(owned: readonly EngineCard[]): EngineCard[] {
  const seen = new Map<string, EngineCard>();
  for (const card of owned) if (!seen.has(card.playerId)) seen.set(card.playerId, card);
  return [...seen.values()];
}

function lastShare(published: Published, playerId: string): number {
  const s = published.shares.get(playerId);
  return s ? s.picks / Math.max(1, s.owners) : 0;
}

export function pickSquad(
  strategy: Strategy,
  member: Member,
  published: Published,
  random: () => number,
  cfg: MidweekConfig,
): EngineCard[] {
  const cards = distinctCards(member.owned);
  const byOvr = (a: EngineCard, b: EngineCard) =>
    b.ovr - a.ovr || (a.playerId < b.playerId ? -1 : 1);
  switch (strategy) {
    case "auto":
      return [];
    case "top_ovr":
      return [...cards].sort(byOvr).slice(0, 5);
    case "random":
      return [...cards]
        .map((card) => ({ card, key: random() }))
        .sort((a, b) => a.key - b.key)
        .slice(0, 5)
        .map(({ card }) => card);
    case "contrarian":
      return [...cards]
        .sort(
          (a, b) =>
            lastShare(published, a.playerId) - lastShare(published, b.playerId) || byOvr(a, b),
        )
        .slice(0, 5);
    case "last_winners": {
      const winners = cards
        .filter((card) => published.finalistPlayers.has(card.playerId))
        .sort(byOvr);
      const rest = cards
        .filter((card) => !published.finalistPlayers.has(card.playerId))
        .sort(byOvr);
      return [...winners, ...rest].slice(0, 5);
    }
    case "thoughtful":
      return thoughtfulSquad(cards, cfg);
  }
}

/**
 * A thought-through weekly pick: a Goalkeeper if one is owned, then the
 * outfielders with the best OVR, leaving out injured Players when there is a
 * choice. Deliberately not pick-share-aware: trying to predict this week's
 * pick shares from last week's did worse than ignoring them in tuning, which
 * is itself the "no pick stays best" goal at work.
 */
function thoughtfulSquad(cards: readonly EngineCard[], cfg: MidweekConfig): EngineCard[] {
  const score = (card: EngineCard) =>
    mulPpm(ovrFactorPpm(card.ovr, cfg), card.injured ? cfg.injuredFitnessPpm : PPM);
  const scored = cards
    .map((card) => ({ card, score: score(card) }))
    .sort((a, b) => b.score - a.score || (a.card.playerId < b.card.playerId ? -1 : 1));
  const keeper = scored.find(({ card }) => card.archetype === "goalkeeper");
  const squad = keeper ? [keeper.card] : [];
  for (const { card } of scored) {
    if (squad.length >= 5) break;
    if (card.archetype !== "goalkeeper") squad.push(card);
  }
  return squad;
}

// --- measurement ----------------------------------------------------------

/** Standout: goal 3, assist 2, save 1, block 1, penalty scored 1, penalty saved 2. */
export function matchStandout(outcome: MatchOutcome): { side: 0 | 1; slot: number } {
  const score = [new Array(5).fill(0), new Array(5).fill(0)];
  for (const event of outcome.events) {
    if (event.kind === "chance") {
      const opp = event.side === 0 ? 1 : 0;
      if (event.outcome === "goal") {
        score[event.side][event.shooter] += 3;
        if (event.creator !== event.shooter) score[event.side][event.creator] += 2;
      } else if (
        (event.outcome === "save" || event.outcome === "block") &&
        event.defender !== null
      ) {
        score[opp][event.defender] += 1;
      }
    } else if (event.kind === "penalty") {
      const opp = event.side === 0 ? 1 : 0;
      if (event.outcome === "goal") score[event.side][event.kicker] += 1;
      if (event.outcome === "save") score[opp][event.keeper] += 2;
    }
  }
  let best = { side: outcome.winnerSide as 0 | 1, slot: 0, value: -1 };
  for (const side of [outcome.winnerSide, outcome.winnerSide === 0 ? 1 : 0] as const) {
    score[side].forEach((value, slot) => {
      if (value > best.value) best = { side, slot, value };
    });
  }
  return { side: best.side, slot: best.slot };
}

type Rate = { hits: number; trials: number };
const rate = (): Rate => ({ hits: 0, trials: 0 });
const record = (r: Rate, hit: boolean) => {
  r.trials += 1;
  if (hit) r.hits += 1;
};
export const ratio = (r: Rate) => (r.trials === 0 ? NaN : r.hits / r.trials);

export type SimOptions = {
  seasons: number;
  weeksPerSeason: number;
  autoShare: number;
  seed: number;
  world: WorldOptions;
  cfg: MidweekConfig;
  injuryRate: number;
};

export const DEFAULT_SIM: SimOptions = {
  seasons: 5000,
  weeksPerSeason: 20,
  autoShare: 0.3,
  seed: 20260925,
  world: DEFAULT_WORLD,
  cfg: MIDWEEK,
  injuryRate: 0.04,
};

export type SimStats = ReturnType<typeof runSimulation>;

function withSaved(inputs: EntrantInput[], userId: string, saved: EngineCard[]): EntrantInput[] {
  return inputs.map((input) => (input.userId === userId ? { ...input, saved } : input));
}

function entryOf(field: { entries: Entry[] }, userId: string): Entry {
  return field.entries.find((entry) => entry.userId === userId)!;
}

export function runSimulation(options: SimOptions) {
  const cfg = options.cfg;
  const strongBeatsWeak = rate();
  const strongBeatsWeakFull = rate();
  const strongWins8 = rate();
  const thoughtfulBeatsRandom = rate();
  const fullBeatsTrialist = rate();
  const autoBeatsPicked = rate();
  const autoLastFour = rate();
  const roundOneFavouriteFinal = rate();
  const cheapStandoutWeek = rate();
  const keeperGoalsPerSeason: number[] = [];
  const habitCoins = new Map<Strategy, { coins: number; memberSeasons: number }>();
  const calibration = Array.from({ length: 10 }, () => ({ predicted: 0, wins: 0, n: 0 }));
  let brier = 0;
  let matchCount = 0;
  let goalTotal = 0;
  let shootouts = 0;
  let chanceTotal = 0;

  for (let season = 0; season < options.seasons; season += 1) {
    const world = generateWorld(options.seed * 7919 + season, options.world);
    const random = world.random;
    const strategies = new Map<string, Strategy>();
    for (const member of world.members) {
      const strategy: Strategy =
        random() < options.autoShare
          ? "auto"
          : ([...HABITS, "thoughtful"] as const)[Math.floor(random() * 5)];
      strategies.set(member.userId, strategy);
    }
    const coins = new Map<string, number>();
    let published: Published = { shares: new Map(), finalistPlayers: new Set() };
    let keeperGoals = 0;

    const byStrength = [...world.members].sort((a, b) => b.strength - a.strength);
    const strongest = byStrength[0];
    const weakest = byStrength[byStrength.length - 1];
    const distinctPlayers = (m: Member) => new Set(m.owned.map((c) => c.playerId)).size;
    const weakestFull = [...byStrength].reverse().find((m) => distinctPlayers(m) >= 5);

    for (let week = 0; week < options.weeksPerSeason; week += 1) {
      const rng = fastRng(cyrb53(`${options.seed}:${season}:${week}`, 1) >>> 0);
      const injured = new Set(
        world.players.filter(() => random() < options.injuryRate).map((p) => p.playerId),
      );
      const members = world.members.map((member) => ({
        ...member,
        owned: member.owned.map((card) => ({ ...card, injured: injured.has(card.playerId) })),
      }));
      const inputs: EntrantInput[] = members.map((member) => ({
        userId: member.userId,
        owned: member.owned,
        saved: pickSquad(strategies.get(member.userId)!, member, published, random, cfg),
      }));

      const result = simulateTournament(rng, inputs, cfg) as SimulatedTournament;
      const entryByUser = new Map(result.entries.map((entry) => [entry.userId, entry]));

      for (const payout of result.payouts) {
        coins.set(payout.userId, (coins.get(payout.userId) ?? 0) + payout.amount);
      }

      // Real-bracket measurements.
      let cheapStandout = false;
      const reached = new Map<string, number>();
      for (const match of result.matches) {
        const outcome = match.outcome;
        matchCount += 1;
        goalTotal += outcome.goals[0] + outcome.goals[1];
        if (outcome.penalties) shootouts += 1;
        for (const event of outcome.events) {
          if (event.kind !== "chance") continue;
          chanceTotal += 1;
          const entry = entryByUser.get(match.userIds[event.side])!;
          if (event.outcome === "goal" && event.shooter === entry.keeperSlot) keeperGoals += 1;
        }
        const p = outcome.winChancePpm / PPM;
        const won = outcome.winnerSide === 0 ? 1 : 0;
        const bucket = Math.min(9, Math.floor(p * 10));
        calibration[bucket].predicted += p;
        calibration[bucket].wins += won;
        calibration[bucket].n += 1;
        brier += (p - won) ** 2;

        const [a, b] = match.userIds.map((id) => entryByUser.get(id)!);
        if (a.auto !== b.auto) {
          const autoSide = a.auto ? 0 : 1;
          record(autoBeatsPicked, outcome.winnerSide === autoSide);
        }
        const standout = matchStandout(outcome);
        const card = entryByUser.get(match.userIds[standout.side])!.cards[standout.slot];
        if (!card.trialist && card.ovr < 50) cheapStandout = true;
        for (const userId of match.userIds) {
          reached.set(userId, Math.max(reached.get(userId) ?? 0, match.round));
        }
      }
      for (const bye of result.byes)
        reached.set(bye.userId, Math.max(reached.get(bye.userId) ?? 0, 1));
      record(cheapStandoutWeek, cheapStandout);

      for (const entry of result.entries) {
        if (entry.auto) record(autoLastFour, (reached.get(entry.userId) ?? 0) >= result.rounds - 1);
      }

      // Strongest-looking squad after round 1: the best rating among round-2 entrants.
      if (result.rounds >= 3) {
        const roundTwo = result.matches
          .filter((match) => match.round === 2)
          .flatMap((m) => m.userIds);
        const favourite = roundTwo.reduce((best, userId) =>
          sideRatingPpm(toMatchSide(entryByUser.get(userId)!), cfg) >
          sideRatingPpm(toMatchSide(entryByUser.get(best)!), cfg)
            ? userId
            : best,
        );
        record(roundOneFavouriteFinal, (reached.get(favourite) ?? 0) >= result.rounds);
      }

      // Counterfactual matches in this week's field.
      const thoughtful = (member: Member) =>
        pickSquad("thoughtful", member, published, random, cfg);
      const strongMember = members.find((m) => m.userId === strongest.userId)!;
      const weakMember = members.find((m) => m.userId === weakest.userId)!;
      const duelInputs = withSaved(
        withSaved(inputs, strongest.userId, thoughtful(strongMember)),
        weakest.userId,
        thoughtful(weakMember),
      );
      const duelField = buildField(rng, duelInputs, cfg);
      const duel = playMatch(
        rng,
        "x:t1",
        toMatchSide(entryOf(duelField, strongest.userId)),
        toMatchSide(entryOf(duelField, weakest.userId)),
        cfg,
      );
      record(strongBeatsWeak, duel.winnerSide === 0);

      // Information only: the same duel against the weakest collection that fields five real cards.
      if (weakestFull && weakestFull.userId !== strongest.userId) {
        const fullMember = members.find((m) => m.userId === weakestFull.userId)!;
        const fullField = buildField(
          rng,
          withSaved(
            withSaved(inputs, strongest.userId, thoughtful(strongMember)),
            weakestFull.userId,
            thoughtful(fullMember),
          ),
          cfg,
        );
        const fullDuel = playMatch(
          rng,
          "x:t1b",
          toMatchSide(entryOf(fullField, strongest.userId)),
          toMatchSide(entryOf(fullField, weakestFull.userId)),
          cfg,
        );
        record(strongBeatsWeakFull, fullDuel.winnerSide === 0);
      }

      const eligible = members.filter((m) => new Set(m.owned.map((c) => c.playerId)).size >= 8);
      if (eligible.length > 0) {
        const member = eligible[Math.floor(random() * eligible.length)];
        const planned = thoughtful(member);
        const plannedField = buildField(rng, withSaved(inputs, member.userId, planned), cfg);
        const plannedEntry = entryOf(plannedField, member.userId);
        const randomField = buildField(
          rng,
          withSaved(inputs, member.userId, pickSquad("random", member, published, random, cfg)),
          cfg,
        );
        const versus = playMatch(
          rng,
          "x:t3",
          toMatchSide(plannedEntry),
          toMatchSide(entryOf(randomField, member.userId)),
          cfg,
        );
        record(thoughtfulBeatsRandom, versus.winnerSide === 0);

        // Leave the weakest card's slot empty on purpose.
        const weakestSlot = plannedEntry.cards.reduce((low, card) =>
          card.powerPpm < low.powerPpm ? card : low,
        ).slot;
        const withGap = planned.filter(
          (card) => card.cardId !== plannedEntry.cards[weakestSlot].cardId,
        );
        const gapField = buildField(rng, withSaved(inputs, member.userId, withGap), cfg);
        const gapMatch = playMatch(
          rng,
          "x:t6",
          toMatchSide(plannedEntry),
          toMatchSide(entryOf(gapField, member.userId)),
          cfg,
        );
        record(fullBeatsTrialist, gapMatch.winnerSide === 0);
      }

      // An eight-entrant tournament from a random subset, strongest collection picking thoughtfully.
      const subset = [...inputs].sort(() => random() - 0.5).slice(0, 8);
      const subsetStrongest = subset.reduce((best, input) =>
        members.find((m) => m.userId === input.userId)!.strength >
        members.find((m) => m.userId === best.userId)!.strength
          ? input
          : best,
      );
      const strongMember8 = members.find((m) => m.userId === subsetStrongest.userId)!;
      const eight = simulateTournament(
        fastRng(cyrb53(`${options.seed}:${season}:${week}:eight`, 2) >>> 0),
        withSaved(subset, subsetStrongest.userId, thoughtful(strongMember8)),
        cfg,
      ) as SimulatedTournament;
      record(strongWins8, eight.championUserId === subsetStrongest.userId);

      // Publish what members see after the final.
      const shares = new Map<string, { picks: number; owners: number }>();
      for (const share of result.pickShares) shares.set(share.playerId, share);
      const final = result.matches.find((match) => match.round === result.rounds)!;
      const finalistPlayers = new Set(
        final.userIds.flatMap((id) =>
          entryByUser
            .get(id)!
            .cards.filter((card) => card.playerId !== null)
            .map((card) => card.playerId!),
        ),
      );
      published = { shares, finalistPlayers };
    }

    keeperGoalsPerSeason.push(keeperGoals);
    for (const member of world.members) {
      const strategy = strategies.get(member.userId)!;
      const bucket = habitCoins.get(strategy) ?? { coins: 0, memberSeasons: 0 };
      bucket.coins += coins.get(member.userId) ?? 0;
      bucket.memberSeasons += 1;
      habitCoins.set(strategy, bucket);
    }
  }

  const habitMeans = new Map(
    [...habitCoins.entries()].map(([strategy, v]) => [strategy, v.coins / v.memberSeasons]),
  );
  const habitValues = HABITS.map((habit) => habitMeans.get(habit) ?? 0).sort((a, b) => b - a);
  const habitLead = habitValues[0] / habitValues[1] - 1;

  return {
    options,
    strongBeatsWeak: ratio(strongBeatsWeak),
    strongBeatsWeakFull: ratio(strongBeatsWeakFull),
    strongWins8: ratio(strongWins8),
    thoughtfulBeatsRandom: ratio(thoughtfulBeatsRandom),
    habitMeans,
    habitLead,
    cheapStandoutWeek: ratio(cheapStandoutWeek),
    fullBeatsTrialist: ratio(fullBeatsTrialist),
    autoBeatsPicked: ratio(autoBeatsPicked),
    autoLastFour: ratio(autoLastFour),
    roundOneFavouriteFinal: ratio(roundOneFavouriteFinal),
    worstCardMargin: worstCardMargin(cfg),
    goalsPerMatch: goalTotal / matchCount,
    chancesPerMatch: chanceTotal / matchCount,
    shootoutRate: shootouts / matchCount,
    keeperGoalsPerSeason:
      keeperGoalsPerSeason.reduce((sum, v) => sum + v, 0) / keeperGoalsPerSeason.length,
    brier: brier / matchCount,
    calibration: calibration.map((b) => ({
      n: b.n,
      predicted: b.n ? b.predicted / b.n : NaN,
      actual: b.n ? b.wins / b.n : NaN,
    })),
    matchCount,
  };
}

/**
 * Worst real card against the best a trialist can be, in expected power. The
 * worst card is OVR 30, picked by every owner (the lowest pick factor a real
 * pick reaches as owners grow) and injured; both share the same form
 * distribution and line shape, so form cancels out.
 */
export function worstCardMargin(cfg: MidweekConfig): number {
  const lowestPick = cfg.pick.points[cfg.pick.points.length - 1][1];
  const worstCard = mulPpm(
    mulPpm(ovrFactorPpm(cfg.ovr.min, cfg), lowestPick),
    cfg.injuredFitnessPpm,
  );
  const trialist = mulPpm(ovrFactorPpm(cfg.trialist.ovr, cfg), cfg.trialist.factorPpm);
  return (worstCard - trialist) / PPM;
}

// --- targets --------------------------------------------------------------

export type Target = {
  name: string;
  goal: string;
  value: string;
  pass: boolean;
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function evaluateTargets(stats: SimStats, tolerance = 0): Target[] {
  const t = tolerance;
  return [
    {
      name: "Strongest collection beats the weakest in a single match",
      goal: "about 65%; signed off at up to 72% (ADR-092)",
      value: pct(stats.strongBeatsWeak),
      pass: stats.strongBeatsWeak >= 0.6 - t && stats.strongBeatsWeak <= 0.72 + t,
    },
    {
      name: "Strongest collection wins the whole tournament (8 entrants)",
      goal: "about 25–30% (22–33%)",
      value: pct(stats.strongWins8),
      pass: stats.strongWins8 >= 0.22 - t && stats.strongWins8 <= 0.33 + t,
    },
    {
      name: "A thought-through five beats a random five from the same collection",
      goal: "at least 60%; signed off at 58% or more (ADR-092)",
      value: pct(stats.thoughtfulBeatsRandom),
      pass: stats.thoughtfulBeatsRandom >= 0.58 - t,
    },
    {
      name: "No fixed habit wins over a 20-week season",
      goal: "best habit ahead of the runner-up by at most 5%",
      value: `${pct(stats.habitLead)} lead`,
      pass: stats.habitLead <= 0.05 + t,
    },
    {
      name: "A Common or Bronze card is a match's standout",
      goal: "most weeks (> 50%), at least once",
      value: pct(stats.cheapStandoutWeek),
      pass: stats.cheapStandoutWeek > 0.5 - t,
    },
    {
      name: "An empty slot is never the best choice",
      goal: "full squad wins > 50% head to head; worst card beats a trialist in expectation",
      value: `${pct(stats.fullBeatsTrialist)}; margin ${stats.worstCardMargin.toFixed(3)}`,
      pass: stats.fullBeatsTrialist > 0.5 - t && stats.worstCardMargin > 0,
    },
    {
      name: "An auto squad beats a typical picked squad",
      goal: "at most about 20%",
      value: pct(stats.autoBeatsPicked),
      pass: stats.autoBeatsPicked <= 0.2 + t,
    },
    {
      name: "An auto squad reaches the last four",
      goal: "about 2% or less",
      value: pct(stats.autoLastFour),
      pass: stats.autoLastFour <= 0.02 + t,
    },
    {
      name: "The squad that looks strongest after round 1 reaches the final",
      goal: "at most about 35%",
      value: pct(stats.roundOneFavouriteFinal),
      pass: stats.roundOneFavouriteFinal <= 0.35 + t,
    },
  ];
}
