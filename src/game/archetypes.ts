// Single source of truth for the card archetypes. The slug list was
// previously duplicated in the rating engine, the admin roster server action,
// the admin add-player form, and the SQL RPCs; import from here instead.
// The attribute offsets themselves stay in `rating-engine.ts` (ARCHETYPE_OFFSETS)
// so the pure formula module keeps everything it needs in one place.
// `goalkeeper` (ADR-036) is a seventh offset profile over the same six
// attributes, not a distinct stat set.

export const ARCHETYPES = [
  "all_rounder",
  "speedster",
  "finisher",
  "playmaker",
  "defender",
  "tank",
  "goalkeeper",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  all_rounder: "All-rounder",
  speedster: "Speedster",
  finisher: "Finisher",
  playmaker: "Playmaker",
  defender: "Defender",
  tank: "Tank",
  goalkeeper: "Goalkeeper",
};

export function isArchetype(value: string): value is Archetype {
  return (ARCHETYPES as readonly string[]).includes(value);
}

/** Human label for a stored archetype slug, with a readable fallback. */
export function archetypeLabel(value: string): string {
  return isArchetype(value) ? ARCHETYPE_LABELS[value] : value.replaceAll("_", " ");
}

// A member may change their own Player's archetype at most once every this
// many days (BUILD_SPEC §145, ADR-094). kut.set_own_player_archetype enforces
// it (migration 20261004000000) as 336 elapsed hours; this copy only tells the
// settings page when the next change is allowed.
export const ARCHETYPE_CHANGE_COOLDOWN_DAYS = 14;
const COOLDOWN_MS = ARCHETYPE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/**
 * When a member may next change their archetype, given the Player's
 * `archetype_changed_at`, or null when a change is allowed now.
 */
export function nextArchetypeChangeAt(
  changedAt: string | null,
  now: Date = new Date(),
): Date | null {
  if (!changedAt) return null;
  const changed = Date.parse(changedAt);
  if (Number.isNaN(changed)) return null;
  const next = new Date(changed + COOLDOWN_MS);
  return next.getTime() > now.getTime() ? next : null;
}

/**
 * "9 October 2026 at 20:15", in club time. Rounded up to the minute, so the
 * time shown is never before the moment the RPC starts allowing a change.
 */
export function formatArchetypeChangeAt(at: Date): string {
  const minute = 60 * 1000;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(Math.ceil(at.getTime() / minute) * minute));
}
