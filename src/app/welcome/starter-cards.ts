import type { RevealCard } from "@/components/pack-reveal";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer, type OwnedCardRow } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Row = OwnedCardRow & { card_id: string; ovr: number };

/** The three `source = 'starter'` copies for the current member, ready to reveal. */
export async function loadStarterCards(supabase: SupabaseServerClient): Promise<RevealCard[]> {
  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select(
      "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
    )
    .eq("source", "starter")
    .order("acquired_at");

  if (error || !data) return [];

  const rows = data as Row[];
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);

  return rows.map((row) => ({
    cardId: row.card_id,
    player: toLiveCardPlayer(row, injuredPlayerIds, photoUrls),
  }));
}
