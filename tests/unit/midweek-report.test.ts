import { describe, expect, it } from "vitest";
import type { Archetype } from "@/game/archetypes";
import {
  simulateTournament,
  type EngineCard,
  type EntrantInput,
  type SimulatedTournament,
} from "@/game/midweek/tournament";
import { FACT_KINDS } from "@/lib/midweek/report/facts";
import { reportInput, type Directory } from "@/lib/midweek/report/from-engine";
import { PHRASE_POOLS } from "@/lib/midweek/report/phrasebook";
import { renderMatchReport, TIMELINE_MAX, TIMELINE_MIN } from "@/lib/midweek/report/render";
import type { MatchReport, ReportInput } from "@/lib/midweek/report/types";
import { fastRng, generateWorld } from "../sim/midweek-world";

const SEED_HASH = "5".repeat(64);
const FIRST_NAMES = [
  "Ada",
  "Bram",
  "Cor",
  "Daan",
  "Eva",
  "Fenna",
  "Gijs",
  "Hanna",
  "Ilse",
  "Joost",
];

const directory: Directory = {
  player: (id) =>
    `${FIRST_NAMES[Number(id.replace(/\D/g, "")) % FIRST_NAMES.length]} ${id.toUpperCase()}`,
  manager: (id) => `Manager ${id.toUpperCase()}`,
};

type Rendered = { input: ReportInput; report: MatchReport };

/** A corpus of rendered matches from KUT-shaped simulated tournaments, with injuries. */
function corpus(tournaments: number): Rendered[] {
  const out: Rendered[] = [];
  for (let t = 0; t < tournaments; t += 1) {
    const world = generateWorld(1000 + t);
    const entrants: EntrantInput[] = world.members.map((member, i) => {
      const owned = member.owned.map((card) => ({
        ...card,
        injured: card.playerId.endsWith(String(t % 7)),
      }));
      const distinct = [...new Map(owned.map((c) => [c.playerId, c])).values()];
      return { userId: member.userId, owned, saved: i % 3 === 0 ? [] : distinct.slice(0, 5) };
    });
    const result = simulateTournament(fastRng(t), entrants) as SimulatedTournament;
    for (const match of result.matches) {
      const input = reportInput(result, match, SEED_HASH, directory);
      out.push({ input, report: renderMatchReport(input) });
    }
  }
  return out;
}

const rendered = corpus(50);
const injuredLayers = new Set(PHRASE_POOLS.filter((p) => p.injured).map((p) => p.layer));

describe("midweek match reports", () => {
  it("renders a thousand matches", () => {
    expect(rendered.length).toBeGreaterThanOrEqual(1_000);
  });

  it("is a pure function of the match and the seed hash", () => {
    for (const { input, report } of rendered.slice(0, 50))
      expect(renderMatchReport(input)).toEqual(report);
    const other = renderMatchReport({ ...rendered[0].input, seedHash: "6".repeat(64) });
    expect(other.phrases).not.toEqual(rendered[0].report.phrases);
  });

  it("never repeats a phrase within one match", () => {
    for (const { report } of rendered) {
      const templates = report.phrases.map((p) => p.template);
      expect(new Set(templates).size, report.headline).toBe(templates.length);
    }
  });

  it("uses injury phrases only when a card in the match was injured at the lock", () => {
    let injuredPhrases = 0;
    for (const { input, report } of rendered) {
      const anyInjured = input.sides.some((side) => side.cards.some((card) => card.injured));
      const used = report.phrases.filter((p) => injuredLayers.has(p.layer)).length;
      if (!anyInjured) expect(used).toBe(0);
      injuredPhrases += used;
    }
    expect(injuredPhrases).toBeGreaterThan(0);
  });

  it("fills every placeholder and keeps the timeline in order", () => {
    for (const { input, report } of rendered) {
      const texts = [
        report.headline,
        ...report.facts.map((f) => f.text),
        ...report.timeline.map((t) => t.text),
        ...(report.shootout?.lines ?? []),
      ];
      for (const text of texts) {
        expect(text, text).not.toMatch(/[{}]|\s{2}|\s[,.!?]/);
        expect(text.length).toBeGreaterThan(0);
      }
      const goals = input.outcome.goals[0] + input.outcome.goals[1];
      const chances = input.outcome.events.filter((e) => e.kind === "chance").length;
      expect(report.timeline.filter((t) => t.kind === "goal")).toHaveLength(goals);
      expect(report.timeline.length).toBeGreaterThanOrEqual(Math.min(TIMELINE_MIN, chances));
      expect(report.timeline.length).toBeLessThanOrEqual(Math.max(TIMELINE_MAX, goals));
      const minutes = report.timeline.map((t) => t.minute);
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
      const last = report.timeline.filter((t) => t.kind === "goal").at(-1);
      if (last) expect(last.score).toEqual(input.outcome.goals);
      expect(report.facts.length).toBeLessThanOrEqual(3);
    }
  });

  it("narrates a shoot-out's misses and its deciding kick", () => {
    const shootouts = rendered.filter(({ report }) => report.shootout);
    expect(shootouts.length).toBeGreaterThan(50);
    for (const { input, report } of shootouts) {
      const kicks = report.shootout!.kicks;
      const unscored = kicks.filter((k) => k.outcome !== "goal").length;
      const toss = input.outcome.events.some((e) => e.kind === "toss");
      const lastScored = kicks.at(-1)!.outcome === "goal";
      // Intro, every miss, and the decider (a scored decider adds a line; a missed one is already counted).
      expect(report.shootout!.lines).toHaveLength(1 + unscored + (toss ? 1 : lastScored ? 1 : 0));
      expect(report.score).toContain("on penalties");
    }
  });

  it("shows owner counts only at three or more, and never names who owns a card", () => {
    for (const { report } of rendered) {
      for (const side of report.why) {
        for (const card of side.cards) {
          if (card.trialist) expect(card.pickLabel).toBeNull();
          else
            expect(card.pickLabel).toMatch(
              /^(a rare pick|auto squad|\d+ of ([3-9]|\d{2,}) owners)$/,
            );
        }
      }
    }
  });

  it("can produce every kind of fact", () => {
    const kinds = new Set(rendered.flatMap(({ report }) => report.facts.map((f) => f.kind)));
    for (const kind of crafted().flatMap((r) => r.facts.map((f) => f.kind))) kinds.add(kind);
    expect([...FACT_KINDS].filter((kind) => !kinds.has(kind))).toEqual([]);
  });

  it("tells the two sides' copies of the same Player apart", () => {
    const shared = crafted().find((r) =>
      r.why.some((side) => side.cards.some((c) => c.name.endsWith("(Keeper Fan)"))),
    );
    expect(shared).toBeDefined();
  });
});

/** Hand-made squads for the rare facts: three keepers, no keeper, hat tricks, injured and cheap stars. */
function crafted(): MatchReport[] {
  let n = 0;
  const card = (
    player: number,
    ovr: number,
    archetype: Archetype,
    injured = false,
  ): EngineCard => ({
    cardId: `k${(n += 1)}`,
    playerId: `q${player}`,
    ovr,
    archetype,
    injured,
  });
  const reports: MatchReport[] = [];
  for (let seed = 0; seed < 120; seed += 1) {
    const entrants: EntrantInput[] = [
      {
        userId: "keeper-fan",
        owned: [
          card(1, 60, "goalkeeper"),
          card(2, 55, "goalkeeper"),
          card(3, 50, "goalkeeper"),
          card(4, 45, "finisher"),
          card(5, 70, "all_rounder"),
        ],
        saved: [],
      },
      {
        userId: "no-keeper",
        owned: [
          card(6, 80, "finisher"),
          card(7, 78, "speedster"),
          card(8, 76, "playmaker"),
          card(9, 74, "tank"),
          card(1, 60, "goalkeeper"),
        ],
        saved: [],
      },
      {
        userId: "cheap",
        owned: [
          card(10, 33, "all_rounder", true),
          card(11, 36, "finisher", true),
          card(12, 44, "speedster"),
        ],
        saved: [],
      },
      {
        userId: "rich",
        owned: [
          card(5, 70, "all_rounder"),
          card(14, 82, "finisher"),
          card(15, 81, "goalkeeper"),
          card(16, 80, "playmaker"),
          card(17, 79, "defender"),
        ],
        saved: [],
      },
    ].map((e) => ({
      ...e,
      saved: e.userId === "no-keeper" ? e.owned.slice(0, 4) : e.owned.slice(0, 5),
    }));
    const result = simulateTournament(fastRng(9_000 + seed), entrants) as SimulatedTournament;
    const names: Directory = {
      player: (id) => `Player ${id.toUpperCase()}`,
      manager: (id) =>
        id === "keeper-fan"
          ? "Keeper Fan"
          : id === "no-keeper"
            ? "No Keeper"
            : id === "cheap"
              ? "Budget"
              : "Big Spender",
    };
    for (const match of result.matches)
      reports.push(renderMatchReport(reportInput(result, match, SEED_HASH, names)));
  }
  return reports;
}
