import { MIDWEEK } from "@/game/midweek/config";
import type { Entry, PlayedMatch, SimulatedTournament } from "@/game/midweek/tournament";
import type { ReportInput, ReportSide } from "./types";

/**
 * Builds report inputs from an engine tournament. The pages will build the same
 * shape from the stored entries and events; this is the reference mapping,
 * including the rule that an owner count below three is never shown (ADR-091).
 */
export type Directory = {
  player: (playerId: string) => string;
  manager: (userId: string) => string;
};

function toSide(entry: Entry, tournament: SimulatedTournament, directory: Directory): ReportSide {
  const shares = new Map(tournament.pickShares.map((share) => [share.playerId, share]));
  return {
    manager: directory.manager(entry.userId),
    auto: entry.auto,
    keeperSlot: entry.keeperSlot,
    keeperless: entry.keeperless,
    cards: entry.cards.map((card) => {
      const share = card.playerId === null ? null : shares.get(card.playerId);
      return {
        name: card.playerId === null ? null : directory.player(card.playerId),
        trialist: card.trialist,
        injured: card.injured,
        ovr: card.ovr,
        archetype: card.archetype,
        ovrFactorPpm: card.ovrFactorPpm,
        formRollPpm: card.formRollPpm,
        pickFactorPpm: card.pickFactorPpm,
        fitnessPpm: card.fitnessPpm,
        handicapPpm: card.handicapPpm,
        powerPpm: card.powerPpm,
        picks: share ? share.picks : null,
        owners: share && share.owners >= MIDWEEK.ownerCountMin ? share.owners : null,
      };
    }),
  };
}

export function reportInput(
  tournament: SimulatedTournament,
  match: PlayedMatch,
  seedHash: string,
  directory: Directory,
): ReportInput {
  const entry = (userId: string) => tournament.entries.find((e) => e.userId === userId)!;
  return {
    seedHash,
    round: match.round,
    rounds: tournament.rounds,
    pairing: match.pairing,
    sides: [
      toSide(entry(match.userIds[0]), tournament, directory),
      toSide(entry(match.userIds[1]), tournament, directory),
    ],
    outcome: match.outcome,
  };
}
