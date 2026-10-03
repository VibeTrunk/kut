import { isArchetype, type Archetype } from "@/game/archetypes";
import { MIDWEEK, PPM } from "@/game/midweek/config";
import { plussesOf, squadBalance } from "@/game/midweek/shape";

/**
 * The picker's plusses count (`MidweekLineCount`, DR3 HANDOFF §4, ADR-116):
 * what the weakest-line rule will make of the five as picked. It calls the
 * engine's own `squadBalance`, so the count can never disagree with the
 * match. Client-safe: `shape.ts` needs no `node:crypto`.
 */

export const LINE_NAMES = ["Attack", "Midfield", "Defence"] as const;

export type LineCount =
  /** No Goalkeeper: who stands in goal is only settled at the lock (DR3-8). */
  | { kind: "nokeeper" }
  | {
      kind: "count";
      lines: [number, number, number];
      short: [number, number, number];
      /** Plusses short in all. */
      total: number;
      balancePpm: number;
      /** The Goalkeeper in goal, or null when several could be. */
      keeper: string | null;
    };

/**
 * The count for the five as picked. Empty slots play as trialists, Common
 * All-rounders (1/1/1). With one Goalkeeper it is in goal; with several, any
 * one of them is, and all are 0/0/3, so the count is the same whichever
 * plays. Without one there is no count: `chooseKeeper` picks the stand-in by
 * power, and power includes the form rolled at the lock.
 */
export function lineCount(
  picked: readonly ({ archetype: string; displayName: string } | null)[],
): LineCount {
  const archetypes: Archetype[] = Array.from({ length: MIDWEEK.squadSize }, (_, slot) => {
    const archetype = picked[slot]?.archetype;
    return archetype && isArchetype(archetype) ? archetype : "all_rounder";
  });
  const keepers = picked.flatMap((card, slot) =>
    card && card.archetype === "goalkeeper" ? [{ slot, name: card.displayName }] : [],
  );
  if (keepers.length === 0) return { kind: "nokeeper" };
  const { lines, short, balancePpm } = squadBalance(archetypes, keepers[0].slot);
  return {
    kind: "count",
    lines,
    short,
    total: short[0] + short[1] + short[2],
    balancePpm,
    keeper: keepers.length === 1 ? keepers[0].name : null,
  };
}

/** `×0.88`: a factor to two decimals, as the copy shows it. */
export const factorText = (ppm: number) => `×${(ppm / PPM).toFixed(2)}`;

/** `Defence 1 short`, `Attack 1 short, Midfield 1 short`. */
export function shortLines(count: Extract<LineCount, { kind: "count" }>): string {
  return LINE_NAMES.flatMap((name, line) =>
    count.short[line] > 0 ? [`${name} ${count.short[line]} short`] : [],
  ).join(", ");
}

/** The verdict under the rows (`aria-live`). */
export function lineVerdict(count: Extract<LineCount, { kind: "count" }>): {
  lead: string;
  rest: string;
} {
  if (count.total === 0) {
    return {
      lead: "Balanced.",
      rest: `Every line has ${MIDWEEK.balance.minPlusses} or more, so no penalty.`,
    };
  }
  return {
    lead: `${shortLines(count)}:`,
    rest: `${count.total === 1 ? "one plus" : `${count.total} plusses`} short, so your whole five plays at ${factorText(count.balancePpm)} this week.`,
  };
}

/** Who goes in goal, under the verdict. */
export function keeperLine(count: Extract<LineCount, { kind: "count" }>): string {
  return count.keeper
    ? `${count.keeper} goes in goal and isn’t counted.`
    : "One of your Goalkeepers goes in goal and isn’t counted; the others play outfield with their plusses.";
}

export const LINE_RULE = `Each line needs ${MIDWEEK.balance.minPlusses} plusses from the four cards not in goal; every plus short costs the whole five ${factorText(MIDWEEK.balance.shortfallPpm)}.`;

export const NO_KEEPER_COUNT =
  "Add a Goalkeeper to see your count. Without one, who stands in goal is only settled at the lock, so the picker can’t say which four cards count.";

/** The sticky save bar's second row on a phone. */
export function lineCountShort(count: LineCount): { tone: "ok" | "short" | "none"; text: string } {
  if (count.kind === "nokeeper")
    return { tone: "none", text: "No Goalkeeper yet, so no line count" };
  if (count.total === 0) return { tone: "ok", text: "✓ Lines balanced" };
  return { tone: "short", text: `! ${shortLines(count)} · ${factorText(count.balancePpm)}` };
}

/** The rows' group label for screen readers: `Attack 4 of 3, enough; …`. */
export function lineCountLabel(count: Extract<LineCount, { kind: "count" }>): string {
  const need = MIDWEEK.balance.minPlusses;
  return LINE_NAMES.map(
    (name, line) =>
      `${name} ${count.lines[line]} of ${need}, ${count.short[line] > 0 ? `${count.short[line]} short` : "enough"}`,
  ).join("; ");
}

/** A pick row's plusses: `A ++ · M ++ · D –`, and its sentence for screen readers. */
export function plussesLine(archetype: string): { text: string; label: string } | null {
  if (!isArchetype(archetype)) return null;
  const [att, mid, def] = plussesOf(archetype);
  const marks = (n: number) => (n === 0 ? "–" : "+".repeat(n));
  return {
    text: `A ${marks(att)} · M ${marks(mid)} · D ${marks(def)}`,
    label: `Plusses: attack ${att}, midfield ${mid}, defence ${def}`,
  };
}
