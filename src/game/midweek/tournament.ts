import type { Archetype } from "@/game/archetypes";
import { MIDWEEK, PPM, type MidweekConfig } from "./config";
import { mulPpm } from "./fixed";
import { drawBracket } from "./bracket";
import { playMatch, type MatchOutcome, type MatchSide } from "./match";
import { cardPowerPpm, formRollPpm, ovrFactorPpm, pickFactorPpm, pickSharePpm } from "./power";
import { roundPayouts } from "./rewards";
import type { Rng } from "./rng";
import { chooseKeeper, lineMultsPpm, type LineMults } from "./shape";

/**
 * A whole tournament as one pure function of the locked squads, the lock-time
 * snapshots and the seed (BUILD_SPEC §44.8, ADR-090). The caller (the SQL
 * worker, or the simulation harness) has already applied the gates and the
 * lock-time ownership checks.
 */

/** A card as snapshotted at the lock. */
export type EngineCard = {
  cardId: string;
  playerId: string;
  ovr: number;
  archetype: Archetype;
  injured: boolean;
};

export type EntrantInput = {
  userId: string;
  /** Saved cards that survived the lock-time checks, in slot order. Empty means no pick. */
  saved: readonly EngineCard[];
  /** Every active card the entrant owns at the lock. */
  owned: readonly EngineCard[];
};

export type EntryCard = {
  slot: number;
  /** Null for a trialist. */
  cardId: string | null;
  playerId: string | null;
  trialist: boolean;
  ovr: number;
  archetype: Archetype;
  injured: boolean;
  ovrFactorPpm: number;
  formRollPpm: number;
  pickFactorPpm: number;
  fitnessPpm: number;
  handicapPpm: number;
  powerPpm: number;
  lines: LineMults;
};

export type Entry = {
  userId: string;
  auto: boolean;
  cards: EntryCard[];
  keeperSlot: number;
  keeperless: boolean;
};

export type PickShare = {
  playerId: string;
  owners: number;
  picks: number;
  sharePpm: number;
  pickFactorPpm: number;
};

export type PlayedMatch = {
  round: number;
  pairing: number;
  userIds: [string, string];
  outcome: MatchOutcome;
};

export type Payout = { userId: string; round: number; amount: number; bye: boolean };

export type SimulatedTournament = {
  status: "simulated";
  size: number;
  rounds: number;
  entries: Entry[];
  pickShares: PickShare[];
  byes: Array<{ pairing: number; userId: string }>;
  matches: PlayedMatch[];
  payouts: Payout[];
  championUserId: string;
};

export type TournamentResult =
  { status: "skipped"; reason: "too_few_entrants" } | SimulatedTournament;

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function validate(entrants: readonly EntrantInput[], cfg: MidweekConfig): void {
  const users = new Set<string>();
  for (const entrant of entrants) {
    if (users.has(entrant.userId)) throw new Error(`Duplicate entrant ${entrant.userId}`);
    users.add(entrant.userId);
    if (entrant.owned.length === 0) throw new Error(`Entrant ${entrant.userId} owns no card`);
    if (entrant.saved.length > cfg.squadSize) throw new Error("A squad holds at most five cards");
    const ownedIds = new Set(entrant.owned.map((card) => card.cardId));
    const players = new Set<string>();
    for (const card of entrant.saved) {
      if (!ownedIds.has(card.cardId)) throw new Error(`Saved card ${card.cardId} is not owned`);
      if (players.has(card.playerId)) throw new Error("A squad fields each Player once");
      players.add(card.playerId);
    }
  }
}

/** Up to five random distinct Players from the collection, one copy each (§44.2). */
export function autoSquad(
  rng: Rng,
  entrant: EntrantInput,
  cfg: MidweekConfig = MIDWEEK,
): EngineCard[] {
  const byPlayer = new Map<string, EngineCard[]>();
  for (const card of entrant.owned) {
    const copies = byPlayer.get(card.playerId) ?? [];
    copies.push(card);
    byPlayer.set(card.playerId, copies);
  }
  const rank = (tag: string, id: string) => ({ id, draw: rng(tag) });
  const byDraw = (a: { id: string; draw: number }, b: { id: string; draw: number }) =>
    a.draw - b.draw || compareIds(a.id, b.id);

  const players = [...byPlayer.keys()]
    .map((playerId) => rank(`auto:p:${entrant.userId}:${playerId}`, playerId))
    .sort(byDraw)
    .slice(0, cfg.squadSize);

  return players.map(({ id: playerId }) => {
    const copies = byPlayer.get(playerId)!;
    const chosen = copies
      .map((card) => rank(`auto:c:${entrant.userId}:${card.cardId}`, card.cardId))
      .sort(byDraw)[0];
    return copies.find((card) => card.cardId === chosen.id)!;
  });
}

export type BuiltField = { entries: Entry[]; pickShares: PickShare[] };

/** Squads, pick shares and every card's week-long factors, before any match is played. */
export function buildField(
  rng: Rng,
  entrantsInput: readonly EntrantInput[],
  cfg: MidweekConfig = MIDWEEK,
): BuiltField {
  validate(entrantsInput, cfg);
  const entrants = [...entrantsInput].sort((a, b) => compareIds(a.userId, b.userId));

  const squads = entrants.map((entrant) => {
    const auto = entrant.saved.length === 0;
    return { entrant, auto, cards: auto ? autoSquad(rng, entrant, cfg) : [...entrant.saved] };
  });

  const owners = new Map<string, number>();
  for (const entrant of entrants) {
    for (const playerId of new Set(entrant.owned.map((card) => card.playerId))) {
      owners.set(playerId, (owners.get(playerId) ?? 0) + 1);
    }
  }
  const picks = new Map<string, number>();
  for (const squad of squads) {
    if (squad.auto) continue;
    for (const card of squad.cards) picks.set(card.playerId, (picks.get(card.playerId) ?? 0) + 1);
  }

  const pickShares: PickShare[] = [...owners.keys()].sort(compareIds).map((playerId) => {
    const ownerCount = owners.get(playerId)!;
    const pickCount = picks.get(playerId) ?? 0;
    const sharePpm = pickSharePpm(pickCount, ownerCount, cfg);
    return {
      playerId,
      owners: ownerCount,
      picks: pickCount,
      sharePpm,
      pickFactorPpm: pickFactorPpm(sharePpm, cfg),
    };
  });
  const shareByPlayer = new Map(pickShares.map((share) => [share.playerId, share]));

  const forms = new Map<string, number>();
  const playerForm = (playerId: string) => {
    let form = forms.get(playerId);
    if (form === undefined) {
      form = formRollPpm(rng, `form:p:${playerId}`, cfg);
      forms.set(playerId, form);
    }
    return form;
  };

  const entries = squads.map(({ entrant, auto, cards }): Entry => {
    const autoHandicap = auto ? cfg.autoFactorPpm : PPM;
    const entryCards: EntryCard[] = [];
    for (let slot = 0; slot < cfg.squadSize; slot += 1) {
      const card = cards[slot];
      if (card) {
        const factors = {
          ovrFactorPpm: ovrFactorPpm(card.ovr, cfg),
          formRollPpm: playerForm(card.playerId),
          pickFactorPpm: auto
            ? cfg.pick.neutralPpm
            : shareByPlayer.get(card.playerId)!.pickFactorPpm,
          fitnessPpm: card.injured ? cfg.injuredFitnessPpm : PPM,
          handicapPpm: autoHandicap,
        };
        entryCards.push({
          slot,
          cardId: card.cardId,
          playerId: card.playerId,
          trialist: false,
          ovr: card.ovr,
          archetype: card.archetype,
          injured: card.injured,
          ...factors,
          powerPpm: cardPowerPpm(factors),
          lines: lineMultsPpm(card.archetype, cfg),
        });
      } else {
        const factors = {
          ovrFactorPpm: ovrFactorPpm(cfg.trialist.ovr, cfg),
          formRollPpm: formRollPpm(rng, `form:t:${entrant.userId}:${slot}`, cfg),
          pickFactorPpm: cfg.pick.neutralPpm,
          fitnessPpm: PPM,
          handicapPpm: mulPpm(autoHandicap, cfg.trialist.factorPpm),
        };
        entryCards.push({
          slot,
          cardId: null,
          playerId: null,
          trialist: true,
          ovr: cfg.trialist.ovr,
          archetype: "all_rounder",
          injured: false,
          ...factors,
          powerPpm: cardPowerPpm(factors),
          lines: lineMultsPpm("all_rounder", cfg),
        });
      }
    }
    const keeper = chooseKeeper(entryCards);
    return {
      userId: entrant.userId,
      auto,
      cards: entryCards,
      keeperSlot: keeper.slot,
      keeperless: keeper.keeperless,
    };
  });

  return { entries, pickShares };
}

export function toMatchSide(entry: Entry): MatchSide {
  return {
    cards: entry.cards.map((card) => ({
      archetype: card.archetype,
      weekPowerPpm: card.powerPpm,
      lines: card.lines,
    })),
    keeperSlot: entry.keeperSlot,
    keeperless: entry.keeperless,
  };
}

export function simulateTournament(
  rng: Rng,
  entrants: readonly EntrantInput[],
  cfg: MidweekConfig = MIDWEEK,
): TournamentResult {
  if (entrants.length < cfg.minEntrants) return { status: "skipped", reason: "too_few_entrants" };

  const { entries, pickShares } = buildField(rng, entrants, cfg);
  const sides = new Map(entries.map((entry) => [entry.userId, toMatchSide(entry)]));
  const bracket = drawBracket(
    rng,
    entries.map((entry) => entry.userId),
  );
  const pays = roundPayouts(bracket.rounds, cfg);

  const byes: SimulatedTournament["byes"] = [];
  const matches: PlayedMatch[] = [];
  const payouts: Payout[] = [];

  let pairings: Array<[string, string | null]> = bracket.pairings;
  for (let round = 1; round <= bracket.rounds; round += 1) {
    const winners: string[] = [];
    pairings.forEach(([first, second], pairing) => {
      if (second === null) {
        byes.push({ pairing, userId: first });
        payouts.push({ userId: first, round, amount: pays[round - 1], bye: true });
        winners.push(first);
        return;
      }
      const outcome = playMatch(
        rng,
        `m:${round}:${pairing}`,
        sides.get(first)!,
        sides.get(second)!,
        cfg,
      );
      const winner = outcome.winnerSide === 0 ? first : second;
      matches.push({ round, pairing, userIds: [first, second], outcome });
      payouts.push({ userId: winner, round, amount: pays[round - 1], bye: false });
      winners.push(winner);
    });
    pairings = [];
    for (let index = 0; index + 1 < winners.length; index += 2) {
      pairings.push([winners[index], winners[index + 1]]);
    }
    if (winners.length === 1) {
      return {
        status: "simulated",
        size: bracket.size,
        rounds: bracket.rounds,
        entries,
        pickShares,
        byes,
        matches,
        payouts,
        championUserId: winners[0],
      };
    }
  }
  throw new Error("unreachable");
}
