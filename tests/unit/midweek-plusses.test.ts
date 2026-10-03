import { describe, expect, it } from "vitest";
import {
  keeperLine,
  LINE_RULE,
  lineCount,
  lineCountLabel,
  lineCountShort,
  lineVerdict,
  plussesLine,
  type LineCount,
} from "@/lib/midweek/plusses";

/** The picker's plusses count (DR3 HANDOFF §4, ADR-116), against the engine's own rule. */

const card = (archetype: string, displayName = archetype) => ({ archetype, displayName });
type Count = Extract<LineCount, { kind: "count" }>;

describe("the picker's plusses count", () => {
  it("is balanced for a Goalkeeper and four specialists that cover every line", () => {
    const count = lineCount([
      card("goalkeeper", "Sem O."),
      card("speedster"),
      card("finisher"),
      card("defender"),
      card("all_rounder"),
    ]) as Count;
    expect(count.lines).toEqual([6, 5, 4]);
    expect(count.total).toBe(0);
    expect(lineVerdict(count)).toEqual({
      lead: "Balanced.",
      rest: "Every line has 3 or more, so no penalty.",
    });
    expect(keeperLine(count)).toBe("Sem O. goes in goal and isn’t counted.");
    expect(lineCountShort(count)).toEqual({ tone: "ok", text: "✓ Lines balanced" });
  });

  it("names a line one short and the factor, as DR3's OneShort", () => {
    // Speedster 2/2/0, Finisher 3/1/0, All-rounder 1/1/1, All-rounder 1/1/1: defence 2.
    const count = lineCount([
      card("goalkeeper", "Sem O."),
      card("speedster"),
      card("finisher"),
      card("all_rounder"),
      card("all_rounder"),
    ]) as Count;
    expect(count.lines).toEqual([7, 5, 2]);
    expect(count.short).toEqual([0, 0, 1]);
    expect(lineVerdict(count)).toEqual({
      lead: "Defence 1 short:",
      rest: "one plus short, so your whole five plays at ×0.88 this week.",
    });
    expect(lineCountShort(count)).toEqual({ tone: "short", text: "! Defence 1 short · ×0.88" });
    expect(lineCountLabel(count)).toBe(
      "Attack 7 of 3, enough; Midfield 5 of 3, enough; Defence 2 of 3, 1 short",
    );
  });

  it("gives the three-keeper gamble two lines short at ×0.77, one keeper in goal", () => {
    const count = lineCount([
      card("goalkeeper"),
      card("goalkeeper"),
      card("goalkeeper"),
      card("defender"),
      card("tank"),
    ]) as Count;
    expect(count.lines).toEqual([0, 3, 11]);
    expect(count.short).toEqual([3, 0, 0]);
    const gamble = lineCount([
      card("goalkeeper"),
      card("goalkeeper"),
      card("goalkeeper"),
      card("speedster"),
      card("defender"),
    ]) as Count;
    expect(gamble.short).toEqual([1, 0, 0]);
    const two = lineCount([
      card("goalkeeper"),
      card("goalkeeper"),
      card("goalkeeper"),
      card("all_rounder"),
      card("all_rounder"),
    ]) as Count;
    expect(two.short).toEqual([1, 1, 0]);
    expect(lineVerdict(two)).toEqual({
      lead: "Attack 1 short, Midfield 1 short:",
      rest: "2 plusses short, so your whole five plays at ×0.77 this week.",
    });
    expect(keeperLine(two)).toBe(
      "One of your Goalkeepers goes in goal and isn’t counted; the others play outfield with their plusses.",
    );
  });

  it("counts empty slots as trialists, Common All-rounders", () => {
    const count = lineCount([card("goalkeeper", "Sem O."), null, null, null, null]) as Count;
    expect(count.lines).toEqual([4, 4, 4]);
    expect(count.total).toBe(0);
  });

  it("has no count without a Goalkeeper (DR3-8)", () => {
    expect(lineCount([card("defender"), card("tank"), null, null, null])).toEqual({
      kind: "nokeeper",
    });
    expect(lineCountShort({ kind: "nokeeper" })).toEqual({
      tone: "none",
      text: "No Goalkeeper yet, so no line count",
    });
  });

  it("states the rule and each card's plusses from the engine's table", () => {
    expect(LINE_RULE).toBe(
      "Each line needs 3 plusses from the four cards not in goal; every plus short costs the whole five ×0.88.",
    );
    expect(plussesLine("speedster")).toEqual({
      text: "A ++ · M ++ · D –",
      label: "Plusses: attack 2, midfield 2, defence 0",
    });
    expect(plussesLine("goalkeeper")?.text).toBe("A – · M – · D +++");
  });
});
