import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { ARCHETYPE_LABELS } from "@/game/archetypes";
import { seedHash, shaRng } from "@/game/midweek/rng";
import {
  simulateTournament,
  type EntrantInput,
  type SimulatedTournament,
} from "@/game/midweek/tournament";
import { getRarityTier } from "@/game/rating-engine";
import { reportInput, type Directory } from "@/lib/midweek/report/from-engine";
import { rateNight, type NightMatch } from "@/lib/midweek/report/ratings";
import { generateWorld } from "./midweek-world";

// Writes sim-output/midweek/sample-ratings.json (gitignored), the input for the ratings mock
// (ADR-117): every member's five with its night rating, each match's ratings
// and the line under each card. It replays the sample world of
// tests/sim/midweek-sample.ts on today's engine; sample-tournament.json keeps
// the DR2 story, so results here differ from it. Run with
//
//   MIDWEEK_WRITE_RATINGS=1 npx vitest run --config vitest.sim.config.mts tests/sim/midweek-ratings-sample.sim.ts

const PLAYERS =
  "Anouk B.,Bas V.,Chris D.,Daan K.,Esther M.,Floor J.,Gijs H.,Hidde P.,Iris W.,Jesse T.,Kees R.,Lotte S.,Mo A.,Noor E.,Olaf G.,Pim L.,Quinten Z.,Roos N.,Sem O.,Tess F.,Umut C.,Vera I.,Wout Y.,Xandra U.,Yara Q.,Zeger X.,Ayla D.,Bram K.,Carmen P.,Dirk S.".split(
    ",",
  );
const MANAGERS =
  "Sanne,Joris,Mila,Thijs,Lieke,Ruben,Fleur,Koen,Nina,Stijn,Eline,Maarten,Julia,Wessel,Anna,Tim,Sophie,Rick,Laura,Niels,Emma,Bart".split(
    ",",
  );
const ROUND_NAMES = ["round 1", "round 2", "the quarter-finals", "the semi-finals", "the final"];

it.skipIf(!process.env.MIDWEEK_WRITE_RATINGS)("writes the Midweek ratings sample", () => {
  const world = generateWorld(20261007);
  const injured = new Set(["p04", "p17"]);
  const entrants: EntrantInput[] = world.members.map((member, i) => {
    const owned = member.owned.map((card) => ({ ...card, injured: injured.has(card.playerId) }));
    const distinct = [...new Map(owned.map((c) => [c.playerId, c])).values()].sort(
      (a, b) => b.ovr - a.ovr,
    );
    const saved = i % 3 === 2 ? [] : distinct.slice(0, i === 4 ? 4 : 5);
    return { userId: member.userId, owned, saved };
  });
  const seed = createHash("sha256").update("midweek-sample").digest("hex");
  const hash = seedHash(seed);
  const tournament = simulateTournament(shaRng(seed), entrants) as SimulatedTournament;
  const directory: Directory = {
    player: (id) => PLAYERS[Number(id.slice(1))],
    manager: (id) => MANAGERS[Number(id.slice(1))],
  };

  const nights = new Map<string, NightMatch[]>();
  for (const match of tournament.matches) {
    const input = reportInput(tournament, match, hash, directory);
    match.userIds.forEach((userId, side) => {
      nights.set(userId, [...(nights.get(userId) ?? []), { input, side: side as 0 | 1 }]);
    });
  }
  const offset = 5 - tournament.rounds;
  const members = tournament.entries.map((entry) => {
    const matches = nights.get(entry.userId) ?? [];
    const night = rateNight({ seedHash: hash, userId: entry.userId, matches });
    const last = matches[matches.length - 1];
    const won = last.input.outcome.winnerSide === last.side;
    return {
      manager: directory.manager(entry.userId),
      auto: entry.auto,
      finish:
        won && last.input.round === tournament.rounds
          ? "champion"
          : `out in ${ROUND_NAMES[last.input.round - 1 + offset]}`,
      matches: matches.map(({ input, side }) => ({
        round: input.round,
        opponent: input.sides[side === 0 ? 1 : 0].manager,
        goals: [input.outcome.goals[side], input.outcome.goals[side === 0 ? 1 : 0]],
        penalties: input.outcome.penalties
          ? [input.outcome.penalties[side], input.outcome.penalties[side === 0 ? 1 : 0]]
          : null,
        won: input.outcome.winnerSide === side,
      })),
      five: night.map((card) => {
        const engineCard = entry.cards[card.slot];
        return {
          name: card.label.text,
          trialist: engineCard.trialist,
          inGoal: card.slot === entry.keeperSlot,
          archetype: ARCHETYPE_LABELS[engineCard.archetype],
          ovr: engineCard.ovr,
          rarity: engineCard.trialist ? null : getRarityTier(engineCard.ovr),
          rating: card.rating,
          matchRatings: card.matchRatings,
          story: card.story,
          line: card.line,
        };
      }),
    };
  });
  const sample = {
    note:
      "Ratings for the ratings mock (ADR-117): the sample world of sample-tournament.json replayed " +
      "on today's engine, so its results differ from that file. Invented names; no real members or Players.",
    seedHash: hash,
    rounds: tournament.rounds,
    champion: directory.manager(tournament.championUserId),
    members,
  };
  const dir = path.resolve(import.meta.dirname, "../../sim-output/midweek");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "sample-ratings.json"), `${JSON.stringify(sample, null, 2)}\n`);
});
