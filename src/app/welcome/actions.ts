"use server";

import { type LiveCardPlayer } from "@/components/live-card";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { loadStarterCards } from "./starter-cards";

export type StarterOpenResult =
  | { ok: true; players: LiveCardPlayer[] }
  | { ok: false; error: string };

export async function markStarterOpened(): Promise<StarterOpenResult> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || typeof claims?.claims?.sub !== "string") {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  const { error } = await supabase.schema("kut").rpc("mark_starter_opened");
  if (error) {
    return { ok: false, error: "Your starter pack could not be opened. Please try again." };
  }

  const cards = await loadStarterCards(supabase);
  const photoUrls = await resolvePhotoUrls(
    supabase,
    cards.map((card) => card.photo_path),
  );
  const players: LiveCardPlayer[] = cards.map(({ photo_path, ...card }) => ({
    ...card,
    photoUrl: photo_path ? photoUrls.get(photo_path) ?? null : null,
  }));

  // No revalidatePath here: the reveal runs client-side and "Enter KUT" links
  // to "/" (a dynamic route, not cached). Revalidating the root layout would
  // re-run this /welcome page, whose guard would then redirect to "/" mid-reveal.
  return { ok: true, players };
}
