import { CHANCE_TYPES } from "@/game/midweek/config";
import { BUILDUP, SOLO_BUILDUP } from "./buildup";
import { FINISHES } from "./finishes";
import { FACT_LINES, HEADLINES } from "./headlines";
import {
  BLOCKS,
  INJURED_CREATOR,
  INJURED_GOAL,
  INJURED_KEEPER,
  SAVES,
  WIDE,
  WOODWORK,
} from "./moments";
import {
  DECISIVE_MISSED,
  DECISIVE_SAVED,
  DECISIVE_SCORED,
  PENALTY_SAVED,
  PENALTY_WIDE,
  PENALTY_WOODWORK,
  SHOOTOUT_INTRO,
  SHOOTOUT_TOSS,
} from "./penalties";

/**
 * Every phrasebook pool with the placeholders it may use, so the rules in
 * `tests/unit/midweek-phrasebook.test.ts` cover every line. A new pool must be
 * registered here.
 */
export type PhrasePool = {
  layer: string;
  placeholders: readonly string[];
  lines: readonly string[];
  /** Whether lines here may mention an injury; only injury layers may. */
  injured: boolean;
  /** Whether this pool narrates a missed chance, which must credit someone. */
  miss: boolean;
};

const pool = (
  layer: string,
  placeholders: readonly string[],
  lines: readonly string[],
  flags: Partial<Pick<PhrasePool, "injured" | "miss">> = {},
): PhrasePool => ({ layer, placeholders, lines, injured: false, miss: false, ...flags });

const CHANCE = ["shooter", "keeper"];
const KICK = ["kicker", "keeper"];

export const PHRASE_POOLS: PhrasePool[] = [
  ...CHANCE_TYPES.map((type) => pool(`buildup:${type}`, ["creator", "shooter"], BUILDUP[type])),
  ...Object.entries(SOLO_BUILDUP).map(([type, lines]) => pool(`solo:${type}`, ["shooter"], lines!)),
  ...CHANCE_TYPES.flatMap((type) =>
    (["sensational", "quality", "routine"] as const).map((tier) =>
      pool(`finish:${type}:${tier}`, CHANCE, FINISHES[type][tier]),
    ),
  ),
  ...(["great", "good", "routine"] as const).map((tier) =>
    pool(`save:${tier}`, CHANCE, SAVES[tier], { miss: true }),
  ),
  pool("woodwork", ["shooter"], WOODWORK, { miss: true }),
  pool("block", ["shooter", "defender"], BLOCKS, { miss: true }),
  pool("wide", ["shooter", "defender"], WIDE, { miss: true }),
  ...(["sensational", "quality", "routine"] as const).map((tier) =>
    pool(`injured-goal:${tier}`, CHANCE, INJURED_GOAL[tier], { injured: true }),
  ),
  pool("injured-creator", ["creator"], INJURED_CREATOR, { injured: true }),
  pool("injured-keeper", ["keeper", "shooter"], INJURED_KEEPER, { injured: true }),
  pool("shootout-intro", ["first", "second"], SHOOTOUT_INTRO),
  pool("penalty:save", KICK, PENALTY_SAVED, { miss: true }),
  pool("penalty:woodwork", KICK, PENALTY_WOODWORK, { miss: true }),
  pool("penalty:wide", KICK, PENALTY_WIDE, { miss: true }),
  pool("penalty-decisive:goal", KICK, DECISIVE_SCORED),
  pool("penalty-decisive:save", KICK, DECISIVE_SAVED, { miss: true }),
  pool("penalty-decisive:woodwork", KICK, DECISIVE_MISSED, { miss: true }),
  pool("penalty-decisive:wide", KICK, DECISIVE_MISSED, { miss: true }),
  pool("shootout-toss", ["winner"], SHOOTOUT_TOSS),
  ...Object.entries(HEADLINES).map(([kind, lines]) =>
    pool(`headline:${kind}`, ["winner", "loser", "score", "hero"], lines),
  ),
  ...Object.entries(FACT_LINES).map(([kind, lines]) =>
    pool(
      `fact:${kind}`,
      ["name", "manager", "opponent", "value", "picks", "owners", "tier"],
      lines,
      { injured: kind === "injured_hero" },
    ),
  ),
];

/** The number of distinct lines in the phrasebook. */
export function phrasebookSize(): number {
  return new Set(PHRASE_POOLS.flatMap((p) => p.lines)).size;
}
