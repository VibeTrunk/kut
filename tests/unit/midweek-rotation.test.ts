import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "@/game/archetypes";
import {
  DEFAULT_SIM,
  generateWorld,
  NO_ROTATION,
  rotates,
  runSimulation,
  weekArchetypes,
  type Player,
  type Rotation,
} from "../sim/midweek-world";

/**
 * The simulated weekly archetype rotation (MM 2.0 C0): the roadmap's rules
 * (owner, 2026-09-30) and the determinism the harness comparison relies on.
 */
const UNIFORM: Rotation = { mode: "uniform", keeperQuota: null, everyWeeks: 1 };

function roster(): Player[] {
  const players = generateWorld(11).players;
  // One inactive and one non-collectible unclaimed Player, which must not rotate.
  const unclaimed = players.filter((player) => !player.claimed);
  unclaimed[0].active = false;
  unclaimed[1].collectible = false;
  return players;
}

describe("simulated archetype rotation", () => {
  it("rotates only active, collectible, unclaimed Players", () => {
    const players = roster();
    const counts = new Map<string, number>();
    for (let week = 0; week < 12; week += 1) {
      const archetypes = weekArchetypes(players, UNIFORM, "k", week);
      for (const player of players) {
        if (archetypes.get(player.playerId) !== player.archetype)
          counts.set(player.playerId, (counts.get(player.playerId) ?? 0) + 1);
      }
    }
    for (const player of players) {
      if (rotates(player)) expect(counts.get(player.playerId) ?? 0).toBeGreaterThan(0);
      else expect(counts.get(player.playerId) ?? 0).toBe(0);
    }
    expect(players.filter((player) => !rotates(player) && !player.claimed)).toHaveLength(2);
  });

  it("draws from every archetype, Goalkeeper and All-rounder included", () => {
    const players = roster();
    const seen = new Set<string>();
    for (let week = 0; week < 20; week += 1) {
      for (const player of players.filter(rotates)) {
        seen.add(weekArchetypes(players, UNIFORM, "k", week).get(player.playerId)!);
      }
    }
    expect([...seen].sort()).toEqual([...ARCHETYPES].sort());
  });

  it("is deterministic, and holds for the rotation period", () => {
    const players = roster();
    const every3: Rotation = { ...UNIFORM, everyWeeks: 3 };
    expect(weekArchetypes(players, UNIFORM, "k", 4)).toEqual(
      weekArchetypes(players, UNIFORM, "k", 4),
    );
    expect(weekArchetypes(players, every3, "k", 3)).toEqual(
      weekArchetypes(players, every3, "k", 5),
    );
    expect(weekArchetypes(players, every3, "k", 2)).not.toEqual(
      weekArchetypes(players, every3, "k", 3),
    );
  });

  it("deals archetypes evenly, and a keeper quota is exact", () => {
    const players = roster();
    const rotating = players.filter(rotates);
    for (let week = 0; week < 10; week += 1) {
      const dealt = weekArchetypes(players, { ...UNIFORM, mode: "deal" }, "k", week);
      const perArchetype = ARCHETYPES.map(
        (archetype) => rotating.filter((p) => dealt.get(p.playerId) === archetype).length,
      );
      expect(Math.max(...perArchetype) - Math.min(...perArchetype)).toBeLessThanOrEqual(1);

      const quota = weekArchetypes(players, { ...UNIFORM, keeperQuota: 2 }, "k", week);
      expect(rotating.filter((p) => quota.get(p.playerId) === "goalkeeper")).toHaveLength(2);
    }
  });

  it("leaves the simulation untouched when off", { timeout: 30_000 }, () => {
    const players = roster();
    const off = weekArchetypes(players, NO_ROTATION, "k", 7);
    for (const player of players) expect(off.get(player.playerId)).toBe(player.archetype);

    const options = {
      ...DEFAULT_SIM,
      seasons: 4,
      weeksPerSeason: 3,
      seed: 5,
      rotation: NO_ROTATION,
    };
    const a = runSimulation(options);
    const b = runSimulation({ ...options, rotation: UNIFORM });
    expect(a.visibility.weeklyChangeRotating).toBe(0);
    expect(b.visibility.weeklyChangeRotating).toBeGreaterThan(0.5);
    // More Goalkeepers in play, so more members own one.
    expect(b.keepers.memberOwnsKeeper).toBeGreaterThan(a.keepers.memberOwnsKeeper);
  });
});
