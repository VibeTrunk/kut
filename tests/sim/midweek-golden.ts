import { createHash } from "node:crypto";
import type { Archetype } from "@/game/archetypes";
import { ARCHETYPES } from "@/game/archetypes";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import { powerSharePpm } from "@/game/midweek/fixed";
import { playMatch, type MatchSide } from "@/game/midweek/match";
import {
  dayRollPpm,
  formRollPpm,
  ovrFactorPpm,
  pickFactorPpm,
  pickSharePpm,
} from "@/game/midweek/power";
import { roundPayouts } from "@/game/midweek/rewards";
import { seedHash, shaRng } from "@/game/midweek/rng";
import { lockAt, revealAt } from "@/game/midweek/schedule";
import { lineMultsPpm } from "@/game/midweek/shape";
import {
  buildField,
  simulateTournament,
  toMatchSide,
  type EngineCard,
  type EntrantInput,
} from "@/game/midweek/tournament";

/**
 * Builds `tests/fixtures/midweek-golden.json`, the shared golden vectors that
 * pin the TypeScript engine now and the SQL engine in the engine migration
 * (ADR-090). Regenerate with `node scripts/midweek/golden.mjs` after any
 * deliberate engine or tuning change, and review the diff.
 */

function seedFor(name: string): string {
  return createHash("sha256").update(`midweek-golden:${name}`).digest("hex");
}

function uuidFor(kind: string, n: number): string {
  const hex = createHash("sha256").update(`${kind}:${n}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

let cardCounter = 0;
function card(player: number, ovr: number, archetype: Archetype, injured = false): EngineCard {
  cardCounter += 1;
  return {
    cardId: uuidFor("card", cardCounter),
    playerId: uuidFor("player", player),
    ovr,
    archetype,
    injured,
  };
}

function entrant(n: number, owned: EngineCard[], savedCount: number): EntrantInput {
  return { userId: uuidFor("user", n), owned, saved: owned.slice(0, savedCount) };
}

function sideFromCards(seed: string, cards: EngineCard[]): MatchSide {
  const field = buildField(shaRng(seed), [
    { userId: uuidFor("user", 0), owned: cards, saved: cards },
  ]);
  return toMatchSide(field.entries[0]);
}

function tournamentCases() {
  cardCounter = 0;
  const cases: Array<{ name: string; entrants: EntrantInput[] }> = [];
  const archetypeAt = (i: number): Archetype => ARCHETYPES[i % ARCHETYPES.length];

  cases.push({
    name: "three entrants are skipped",
    entrants: [1, 2, 3].map((u) => entrant(u, [card(u, 40 + u, "all_rounder")], 1)),
  });

  for (const size of [4, 5, 6, 8, 9]) {
    cases.push({
      name: `${size} entrants, mixed squads`,
      entrants: Array.from({ length: size }, (_, i) => {
        const owned = Array.from({ length: 3 + ((i * 3) % 6) }, (_, j) =>
          card(
            100 * size + ((i * 7 + j * 3) % 25),
            30 + ((i * 11 + j * 13) % 54),
            archetypeAt(i + j),
          ),
        );
        const distinct = new Map(owned.map((c) => [c.playerId, c]));
        const unique = [...distinct.values()];
        return {
          userId: uuidFor("user", 100 * size + i),
          owned,
          saved: unique.slice(0, i % 3 === 0 ? 0 : Math.min(5, i + 1)),
        };
      }),
    });
  }

  cases.push({
    name: "edge squads: keeperless, three keepers, one real card, injured, auto",
    entrants: [
      entrant(
        501,
        [
          card(1, 75, "finisher"),
          card(2, 70, "speedster"),
          card(3, 65, "playmaker"),
          card(4, 60, "tank"),
          card(5, 55, "defender"),
        ],
        5,
      ),
      entrant(
        502,
        [
          card(6, 62, "goalkeeper"),
          card(7, 58, "goalkeeper"),
          card(8, 44, "goalkeeper"),
          card(9, 50, "all_rounder"),
          card(10, 41, "all_rounder"),
        ],
        5,
      ),
      entrant(503, [card(11, 33, "all_rounder")], 1),
      entrant(
        504,
        [
          card(12, 80, "goalkeeper", true),
          card(13, 72, "all_rounder", true),
          card(14, 38, "speedster"),
        ],
        3,
      ),
      entrant(
        505,
        [
          card(15, 45, "all_rounder"),
          card(15, 45, "all_rounder"),
          card(16, 52, "tank"),
          card(17, 36, "goalkeeper"),
          card(18, 49, "finisher"),
          card(19, 57, "playmaker"),
          card(20, 61, "defender"),
        ],
        0,
      ),
      entrant(
        506,
        [
          card(1, 75, "finisher"),
          card(6, 62, "goalkeeper"),
          card(21, 83, "all_rounder"),
          card(22, 30, "all_rounder"),
        ],
        0,
      ),
    ],
  });

  cases.push({
    name: "everyone owns and picks the same five",
    entrants: [601, 602, 603, 604, 605].map((u) =>
      entrant(
        u,
        [31, 32, 33, 34, 35].map((p, i) => card(p, 40 + i * 9, archetypeAt(i))),
        5,
      ),
    ),
  });

  return cases;
}

function matchCases() {
  cardCounter = 1000;
  const allRounders = (base: number, ovr: number) =>
    Array.from({ length: 5 }, (_, i) => card(base + i, ovr, "all_rounder"));
  const withKeeper = (base: number) => [
    card(base, 60, "goalkeeper"),
    card(base + 1, 60, "defender"),
    card(base + 2, 60, "playmaker"),
    card(base + 3, 60, "speedster"),
    card(base + 4, 60, "finisher"),
  ];
  return [
    { name: "equal All-rounders", a: allRounders(700, 50), b: allRounders(710, 50) },
    {
      name: "Goalkeeper side against a keeperless side",
      a: withKeeper(720),
      b: allRounders(730, 60),
    },
    { name: "Elite against Common", a: allRounders(740, 83), b: allRounders(750, 30) },
    {
      name: "three keepers against specialists",
      a: [
        card(760, 55, "goalkeeper"),
        card(761, 55, "goalkeeper"),
        card(762, 55, "goalkeeper"),
        card(763, 55, "tank"),
        card(764, 55, "finisher"),
      ],
      b: withKeeper(770),
    },
    {
      name: "injured side",
      a: allRounders(780, 55).map((c) => ({ ...c, injured: true })),
      b: allRounders(790, 55),
    },
    {
      name: "two trialists each",
      a: allRounders(800, 45).slice(0, 3),
      b: allRounders(810, 45).slice(0, 3),
    },
  ];
}

/** Seeds for matches that go to penalties, found by scanning a fixed seed sequence. */
function shootoutSeeds(sides: [MatchSide, MatchSide], wanted: number) {
  const found: Array<{ seed: string; suddenDeath: boolean }> = [];
  let sawSuddenDeath = false;
  for (let n = 0; found.length < wanted && n < 5000; n += 1) {
    const seed = seedFor(`shootout:${n}`);
    const outcome = playMatch(shaRng(seed), "m:1:0", sides[0], sides[1]);
    if (!outcome.penalties) continue;
    const sudden = outcome.events.some(
      (e) => e.kind === "penalty" && e.round > MIDWEEK.penalties.kicks,
    );
    if (sudden && sawSuddenDeath) continue;
    if (sudden) sawSuddenDeath = true;
    found.push({ seed, suddenDeath: sudden });
  }
  return found;
}

export function buildGolden() {
  const drawSeed = seedFor("draws");
  const rng = shaRng(drawSeed);
  const drawTags = ["", "a", "form:p:x", "m:1:0:c:0:occ", "bracket:seat:7", "ü-unicode"];

  const matches = matchCases().map(({ name, a, b }) => {
    const seed = seedFor(`match:${name}`);
    const sides: [MatchSide, MatchSide] = [sideFromCards(seed, a), sideFromCards(seed, b)];
    return {
      name,
      seed,
      prefix: "m:1:0",
      sides,
      outcome: playMatch(shaRng(seed), "m:1:0", sides[0], sides[1]),
    };
  });

  const level = matchCases()[0];
  const levelSides: [MatchSide, MatchSide] = [
    sideFromCards(seedFor("level"), level.a),
    sideFromCards(seedFor("level"), level.b),
  ];
  for (const { seed, suddenDeath } of shootoutSeeds(levelSides, 3)) {
    matches.push({
      name: suddenDeath ? "shoot-out into sudden death" : "shoot-out",
      seed,
      prefix: "m:1:0",
      sides: levelSides,
      outcome: playMatch(shaRng(seed), "m:1:0", levelSides[0], levelSides[1]),
    });
  }

  const tournaments = tournamentCases().map(({ name, entrants }) => {
    const seed = seedFor(`tournament:${name}`);
    return {
      name,
      seed,
      seedHash: seedHash(seed),
      entrants,
      result: simulateTournament(shaRng(seed), entrants),
    };
  });

  const formRng = shaRng(seedFor("forms"));
  const dayRng = shaRng(seedFor("days"));
  return {
    description:
      "Midweek Madness golden vectors (ADR-090). Generated by scripts/midweek/golden.mjs; " +
      "both the TypeScript engine and the SQL engine must reproduce every value.",
    ppm: PPM,
    config: MIDWEEK,
    draws: drawTags.map((tag) => ({ seed: drawSeed, tag, draw: rng(tag) })),
    ovrFactors: [0, 29, 30, 31, 45, 56, 82, 83, 99].map((ovr) => ({ ovr, ppm: ovrFactorPpm(ovr) })),
    formRolls: ["form:p:a", "form:p:b", "form:t:u:3"].map((tag) => ({
      seed: seedFor("forms"),
      tag,
      ppm: formRollPpm(formRng, tag),
    })),
    dayRolls: ["m:1:0:day:0:0", "m:2:1:day:1:4"].map((tag) => ({
      seed: seedFor("days"),
      tag,
      ppm: dayRollPpm(dayRng, tag),
    })),
    pickShares: [
      [0, 1],
      [1, 1],
      [1, 10],
      [9, 10],
      [3, 3],
      [0, 22],
      [22, 22],
    ].map(([picks, owners]) => {
      const sharePpm = pickSharePpm(picks, owners);
      return { picks, owners, sharePpm, pickFactorPpm: pickFactorPpm(sharePpm) };
    }),
    lineMults: Object.fromEntries(ARCHETYPES.map((a) => [a, lineMultsPpm(a)])),
    powerShares: [
      [1_000_000, 1_000_000, 1],
      [1_300_000, 1_000_000, 2],
      [5_500_000, 4_200_000, 3],
      [0, 0, 2],
    ].map(([a, b, k]) => ({ a, b, k, ppm: powerSharePpm(a, b, k) })),
    payouts: [1, 2, 3, 4, 5, 6].map((rounds) => ({ rounds, pays: roundPayouts(rounds) })),
    schedule: [
      "2026-03-23",
      "2026-03-30",
      "2026-10-19",
      "2026-10-26",
      "2027-03-29",
      "2027-10-25",
    ].map((weekStart) => {
      const lock = lockAt(weekStart);
      return {
        weekStart,
        lockAt: lock.toISOString(),
        round1RevealAt: revealAt(lock, 1).toISOString(),
      };
    }),
    matches,
    tournaments,
  };
}
