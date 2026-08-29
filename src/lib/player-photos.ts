import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const PLAYER_PHOTO_BUCKET = "player-photos";

/** Canonical storage object path for a player's card photo (BUILD_SPEC §90). */
export function playerPhotoPath(playerId: string): string {
  return `players/${playerId}/profile.webp`;
}

/**
 * The privacy seam for player-card photos. The `player-photos` bucket is
 * private, so images are only reachable through short-lived signed URLs minted
 * here on the server. Every page that renders `LiveCard`s calls this once with
 * all its `photo_path` values and passes `photoUrl={map.get(path) ?? null}`.
 *
 * If the bucket is ever made public, this is the only file that changes: swap
 * the batched `createSignedUrls` call for `getPublicUrl` per path.
 */
export async function resolvePhotoUrls(
  supabase: SupabaseServerClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const map = new Map<string, string>();
  if (unique.length === 0) {
    return map;
  }

  const { data, error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .createSignedUrls(unique, 3600);

  if (error || !data) {
    return map;
  }

  for (const entry of data) {
    if (entry.signedUrl && !entry.error && entry.path) {
      map.set(entry.path, entry.signedUrl);
    }
  }

  return map;
}
