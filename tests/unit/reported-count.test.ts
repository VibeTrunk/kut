import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GOALS_ASSISTS_CUTOVER,
  countAttributive,
  countColumnLabel,
  countLabel,
  countLabelLong,
  countNoun,
  countQuestion,
  formatGoals,
  formatGoalsAssists,
  formatReportedCount,
  reportsGoalsAndAssists,
  speakReportedCount,
} from "@/game/reported-count";

// ADR-101: from the football week beginning 2026-09-28 a session's one count is
// goals + assists combined; before it, the same integer means goals.
describe("the goals + assists cutover", () => {
  it("is the Monday of the football week beginning 28 Sep 2026", () => {
    expect(GOALS_ASSISTS_CUTOVER).toBe("2026-09-28");
    expect(new Date(`${GOALS_ASSISTS_CUTOVER}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it("keeps goals on 27 Sep and switches to G+A on 28 Sep", () => {
    expect(reportsGoalsAndAssists("2026-09-27")).toBe(false);
    expect(reportsGoalsAndAssists("2026-09-28")).toBe(true);
    expect(reportsGoalsAndAssists("2026-10-02")).toBe(true);
    expect(reportsGoalsAndAssists("2026-09-07")).toBe(false);
  });

  it("labels each side of the boundary in its own terms", () => {
    expect(countLabel("2026-09-27")).toBe("Goals");
    expect(countLabel("2026-09-28")).toBe("G+A");
    expect(countLabelLong("2026-09-27")).toBe("Goals");
    expect(countLabelLong("2026-09-28")).toBe("Goals + Assists");
    expect(countNoun("2026-09-27")).toBe("goals");
    expect(countNoun("2026-09-28")).toBe("G+A");
  });

  it("modifies another noun in the terms of its date", () => {
    expect(countAttributive("2026-09-27")).toBe("goal");
    expect(countAttributive("2026-09-28")).toBe("G+A");
  });

  it("asks the question that matches the session", () => {
    expect(countQuestion("2026-09-27")).toBe("How many goals did you score?");
    expect(countQuestion("2026-09-28")).toBe("How many goals and assists did you get in total?");
  });

  it("reads a value that is not an ISO date as historical, never relabelling it", () => {
    expect(reportsGoalsAndAssists("")).toBe(false);
    expect(reportsGoalsAndAssists(null)).toBe(false);
    expect(reportsGoalsAndAssists(undefined)).toBe(false);
    expect(reportsGoalsAndAssists("28-09-2026")).toBe(false);
    expect(countLabel("")).toBe("Goals");
  });
});

describe("formatting a count", () => {
  it("keeps historical goals singular and plural", () => {
    expect(formatGoals(1)).toBe("1 goal");
    expect(formatGoals(2)).toBe("2 goals");
    expect(formatGoals(0)).toBe("0 goals");
    expect(formatReportedCount(1, "2026-09-27")).toBe("1 goal");
    expect(formatReportedCount(2, "2026-09-21")).toBe("2 goals");
  });

  it("states a combined count as one total with one unit", () => {
    expect(formatGoalsAssists(1)).toBe("1 G+A");
    expect(formatGoalsAssists(4)).toBe("4 G+A");
    expect(formatReportedCount(1, "2026-09-28")).toBe("1 G+A");
    expect(formatReportedCount(4, "2026-09-28")).toBe("4 G+A");
  });

  it("never pretends to know the goals / assists split of a combined count", () => {
    for (const count of [0, 1, 2, 4, 10]) {
      const text = formatReportedCount(count, "2026-10-05");
      expect(text).not.toMatch(/goal|assist/i);
      expect(text).toBe(`${count} G+A`);
    }
  });

  it("spells G+A out for a screen reader", () => {
    expect(speakReportedCount(4, "2026-09-28")).toBe("4 goals and assists");
    expect(speakReportedCount(1, "2026-09-27")).toBe("1 goal");
  });

  it("heads a column by what its rows hold", () => {
    expect(countColumnLabel(["2026-09-14", "2026-09-21"])).toBe("Goals");
    expect(countColumnLabel(["2026-09-28", "2026-10-05"])).toBe("G+A");
    expect(countColumnLabel(["2026-09-21", "2026-09-28"])).toBe("Goals / G+A");
    expect(countColumnLabel([])).toBe("Goals");
  });
});

describe("the SQL twin of the cutover", () => {
  it("states the same date as the TypeScript constant", () => {
    const sql = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../supabase/migrations/20261009000000_goals_assists_notice_copy.sql",
      ),
      "utf8",
    );
    const helper = /create function kut\._uses_combined_count[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql);
    expect(helper?.[1]).toContain(`p_session_date >= date '${GOALS_ASSISTS_CUTOVER}'`);
  });
});

// Midweek Madness simulates real goals; its wording must not follow the cutover.
describe("Midweek Madness is untouched", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });
  }

  it("never reads the real-life count terminology", () => {
    const src = path.resolve(import.meta.dirname, "../../src");
    const midweek = [
      ...files(path.join(src, "game/midweek")),
      ...files(path.join(src, "lib/midweek")),
      ...files(path.join(src, "components/midweek")),
    ];
    expect(midweek.length).toBeGreaterThan(0);
    for (const file of midweek) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("reported-count");
      expect(text, file).not.toContain("G+A");
    }
  });
});
