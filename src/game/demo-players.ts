import {
  rebuildRatingState,
  type Archetype,
  type FootballWeek,
} from "@/game/rating-engine";

type DemoPlayerInput = {
  name: string;
  archetype: Archetype;
  weeks: FootballWeek[];
};

const inputs: DemoPlayerInput[] = [
  {
    name: "Alex Example",
    archetype: "finisher",
    weeks: [
      { weekStart: "2026-08-03", hasPublishedSession: true, appearances: 1, goals: 1 },
      { weekStart: "2026-08-10", hasPublishedSession: true, appearances: 2, goals: 2 },
    ],
  },
  {
    name: "Bea Test",
    archetype: "playmaker",
    weeks: [
      { weekStart: "2026-08-03", hasPublishedSession: true, appearances: 2, goals: 0 },
      { weekStart: "2026-08-10", hasPublishedSession: true, appearances: 2, goals: 0 },
      { weekStart: "2026-08-17", hasPublishedSession: true, appearances: 1, goals: 1 },
    ],
  },
  {
    name: "Charlie Fixture",
    archetype: "defender",
    weeks: [
      { weekStart: "2026-08-03", hasPublishedSession: true, appearances: 1, goals: 0 },
      { weekStart: "2026-08-10", hasPublishedSession: false, appearances: 0, goals: 0 },
    ],
  },
];

export const demoPlayers = inputs.map((player) => ({
  ...player,
  state: rebuildRatingState(player.weeks, player.archetype),
}));
