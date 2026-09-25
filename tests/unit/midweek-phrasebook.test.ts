import { describe, expect, it } from "vitest";
import { CHANCE_TYPES, MIDWEEK } from "@/game/midweek/config";
import { PHRASE_POOLS, phrasebookSize } from "@/lib/midweek/report/phrasebook";

/**
 * The Midweek phrasebook rules (BUILD_SPEC §44.10), in the spirit of the
 * CAST_LINES tests (ADR-087). The rules a test cannot judge (tone, humour,
 * nothing hurtful to a clubmate) are for the owner's read-through in review.
 */

const words = (line: string) => line.toLowerCase().match(/[a-z']+/g) ?? [];

/** Names only: KUT records no pronouns, so a line never guesses one. */
const GENDERED = [
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "man",
  "men",
  "lads",
  "lad",
];
/** Nothing medical anywhere. */
const MEDICAL = [
  "hospital",
  "doctor",
  "physio",
  "surgery",
  "operation",
  "fracture",
  "fractured",
  "broken",
  "sprain",
  "sprained",
  "torn",
  "tear",
  "ligament",
  "ligaments",
  "concussion",
  "diagnosis",
  "treatment",
  "rehab",
  "pain",
  "painful",
  "crutches",
  "stretcher",
  "bandage",
  "strain",
  "pulled",
];
/** The injury layers never mention a body part. */
const BODY_PARTS = [
  "knee",
  "knees",
  "ankle",
  "ankles",
  "leg",
  "legs",
  "foot",
  "feet",
  "toe",
  "toes",
  "hamstring",
  "calf",
  "shin",
  "hip",
  "groin",
  "shoulder",
  "wrist",
  "arm",
  "arms",
  "hand",
  "hands",
  "elbow",
  "back",
  "neck",
  "head",
  "body",
];
/** Only the injury layers talk about injuries. */
const INJURY_WORDS = ["injured", "injury", "plaster", "cast", "limps", "limping", "hobbles"];
/** A miss credits someone; it never mocks the shooter. */
const RIDICULE = [
  "fluff",
  "fluffs",
  "miskick",
  "miskicks",
  "shank",
  "shanks",
  "scuff",
  "scuffs",
  "embarrassing",
  "embarrassed",
  "awful",
  "woeful",
  "dreadful",
  "hopeless",
  "howler",
  "clueless",
  "useless",
  "pathetic",
  "blunder",
  "blunders",
  "sitter",
];

describe("midweek phrasebook", () => {
  it("is the several-hundred-line phrasebook the launch promised", () => {
    expect(phrasebookSize()).toBeGreaterThanOrEqual(450);
  });

  it("uses only the placeholders each layer provides", () => {
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        for (const [, key] of line.matchAll(/\{(\w+)\}/g)) {
          expect(pool.placeholders, `${pool.layer}: ${line}`).toContain(key);
        }
        expect(line.replace(/\{\w+\}/g, ""), `${pool.layer}: ${line}`).not.toMatch(/[{}]/);
      }
    }
  });

  it("keeps every line short, trimmed and punctuated", () => {
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        expect(line.trim(), line).toBe(line);
        expect(line.length, line).toBeGreaterThan(8);
        expect(line.length, line).toBeLessThanOrEqual(pool.layer.startsWith("headline") ? 80 : 110);
        expect(line, line).not.toMatch(/\s{2}|\s[,.!?:;]/);
        if (!pool.layer.startsWith("headline")) expect(line, line).toMatch(/[.!?]$/);
      }
    }
  });

  it("never repeats a line", () => {
    const seen = new Map<string, string>();
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        const other = seen.get(line);
        // One pool is deliberately registered twice: a deciding kick that hits the woodwork or goes wide.
        if (
          other &&
          !(other.startsWith("penalty-decisive") && pool.layer.startsWith("penalty-decisive"))
        ) {
          throw new Error(`"${line}" is in both ${other} and ${pool.layer}`);
        }
        seen.set(line, pool.layer);
      }
    }
  });

  it("never uses a gendered word or a medical term", () => {
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        for (const word of words(line)) {
          expect(GENDERED, `${pool.layer}: ${line}`).not.toContain(word);
          expect(MEDICAL, `${pool.layer}: ${line}`).not.toContain(word);
        }
      }
    }
  });

  it("talks about injuries only in the injury layers, and never names a body part there", () => {
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        const lineWords = words(line);
        if (pool.injured) {
          for (const word of lineWords)
            expect(BODY_PARTS, `${pool.layer}: ${line}`).not.toContain(word);
        } else {
          for (const word of lineWords)
            expect(INJURY_WORDS, `${pool.layer}: ${line}`).not.toContain(word);
        }
      }
    }
  });

  it("credits someone for every miss and never mocks the shooter", () => {
    for (const pool of PHRASE_POOLS) {
      for (const line of pool.lines) {
        for (const word of words(line))
          expect(RIDICULE, `${pool.layer}: ${line}`).not.toContain(word);
      }
      if (pool.layer === "block" || pool.layer === "wide") {
        for (const line of pool.lines) expect(line, line).toContain("{defender}");
      }
      if (
        pool.layer.startsWith("save:") ||
        pool.layer === "penalty:save" ||
        pool.layer === "penalty:wide"
      ) {
        for (const line of pool.lines) expect(line, line).toContain("{keeper}");
      }
    }
  });

  it("keeps enough variety that no layer quietly shrinks", () => {
    const size = (layer: string) => PHRASE_POOLS.find((p) => p.layer === layer)?.lines.length ?? 0;
    for (const type of CHANCE_TYPES) {
      expect(size(`buildup:${type}`), type).toBeGreaterThanOrEqual(6);
      for (const tier of ["sensational", "quality", "routine"]) {
        expect(size(`finish:${type}:${tier}`), `${type}:${tier}`).toBeGreaterThanOrEqual(4);
      }
    }
    for (const type of MIDWEEK.chanceTypes.solo) {
      expect(size(`solo:${type}`), type).toBeGreaterThanOrEqual(4);
    }
    for (const tier of ["great", "good", "routine"])
      expect(size(`save:${tier}`)).toBeGreaterThanOrEqual(8);
    for (const layer of ["woodwork", "block", "wide"])
      expect(size(layer)).toBeGreaterThanOrEqual(10);
    for (const tier of ["sensational", "quality", "routine"]) {
      expect(size(`injured-goal:${tier}`)).toBeGreaterThanOrEqual(5);
    }
    expect(size("injured-creator")).toBeGreaterThanOrEqual(6);
    expect(size("injured-keeper")).toBeGreaterThanOrEqual(6);
    expect(size("penalty:save")).toBeGreaterThanOrEqual(8);
    for (const pool of PHRASE_POOLS) {
      if (pool.layer.startsWith("headline:") || pool.layer.startsWith("fact:")) {
        expect(pool.lines.length, pool.layer).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
