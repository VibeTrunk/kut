import { type LiveCardPlayer } from "@/components/live-card";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type StarterCard = Omit<LiveCardPlayer, "photoUrl"> & { photo_path: string | null };

type Row = {
  card_id: string;
  display_name: string;
  archetype: string;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  photo_path: string | null;
};

/** The three `source = 'starter'` copies for the current member. */
export async function loadStarterCards(supabase: SupabaseServerClient): Promise<StarterCard[]> {
  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select("card_id, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path")
    .eq("source", "starter")
    .order("acquired_at");

  if (error || !data) return [];

  return (data as Row[]).map((row) => ({
    id: row.card_id,
    displayName: row.display_name,
    archetype: row.archetype,
    liveOvr: row.ovr,
    pac: row.pac,
    sho: row.sho,
    pas: row.pas,
    dri: row.dri,
    def: row.def,
    phy: row.phy,
    rarityTier: row.rarity_tier,
    photo_path: row.photo_path,
  }));
}
