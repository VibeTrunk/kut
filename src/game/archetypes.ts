// Single source of truth for the six card archetypes. The slug list was
// previously duplicated in the rating engine, the admin roster server action,
// the admin add-player form, and the SQL RPCs; import from here instead.
// The attribute offsets themselves stay in `rating-engine.ts` (ARCHETYPE_OFFSETS)
// so the pure formula module keeps everything it needs in one place.

export const ARCHETYPES = [
  "all_rounder",
  "speedster",
  "finisher",
  "playmaker",
  "defender",
  "tank",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  all_rounder: "All-rounder",
  speedster: "Speedster",
  finisher: "Finisher",
  playmaker: "Playmaker",
  defender: "Defender",
  tank: "Tank",
};

export function isArchetype(value: string): value is Archetype {
  return (ARCHETYPES as readonly string[]).includes(value);
}

/** Human label for a stored archetype slug, with a readable fallback. */
export function archetypeLabel(value: string): string {
  return isArchetype(value) ? ARCHETYPE_LABELS[value] : value.replaceAll("_", " ");
}
