/**
 * What the club wrote on an injured Player's cast (injury mode, ADR-082,
 * ADR-084). Derived from the Player id, so every copy of the card carries the
 * same cast and the server render is deterministic, unless `CAST_OVERRIDES`
 * picks the lines. At most 20 characters a line; never a member's name, never
 * the admin injury note.
 */
export const CAST_LINES = [
  "Get well soon!!",
  "Beterschap, maat!",
  "Who brings the bibs?",
  "It was never a foul",
  "Snel weer terug!",
  "Rest up, legend",
  "TFH misses you",
  "Doc says: no rabonas",
  "Walk it off (later)",
  "Sterkte, kanjer!",
  "Back next week??",
  "Hou je taai!",
] as const;

/**
 * The two lines the club chose for one Player's cast, by Player id (ADR-087).
 * They replace the hashed pair; ink and doodle stay hashed. The pool's rules
 * hold here too: two different lines of at most 20 characters, never a
 * member's name and nothing medical. A change is a code change, no migration.
 */
export const CAST_OVERRIDES: ReadonlyMap<string, readonly [string, string]> = new Map([
  // Darryl.
  ["61d89bd7-248d-4c1c-bf36-f7d4efdf07ce", ["Rest up, legend", "Doc says: no rabonas"]],
]);

export const CAST_INKS = ["blue", "green", "black"] as const;

export const CAST_DOODLES = ["smiley", "heart"] as const;

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function injuryCast(playerId: string) {
  const hash = fnv1a(playerId);
  const count = CAST_LINES.length;
  const first = hash % count;
  // An offset of 1..count-1, so the two lines always differ.
  const second = (first + 1 + ((hash >>> 8) % (count - 1))) % count;
  const chosen = CAST_OVERRIDES.get(playerId);
  return {
    first: chosen?.[0] ?? CAST_LINES[first],
    second: chosen?.[1] ?? CAST_LINES[second],
    ink: CAST_INKS[(hash >>> 16) % CAST_INKS.length],
    doodle: CAST_DOODLES[(hash >>> 24) % CAST_DOODLES.length],
  } as const;
}
