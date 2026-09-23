import { notFound } from "next/navigation";
import { PackReveal, type RevealCard } from "@/components/pack-reveal";
import { type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { cardFace } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

type PackResultPageProps = { params: Promise<{ openingId: string }> };

type PackResultCard = {
  opening_id: string;
  opened_at: string;
  price_paid: number;
  pack_title: string;
  slot: number;
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

export default async function PackResultPage({ params }: PackResultPageProps) {
  await requireUser();
  const { openingId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_pack_opening_results")
    .select(
      "opening_id, opened_at, price_paid, pack_title, slot, card_id, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
    )
    .eq("opening_id", openingId)
    .order("slot");

  if (error) throw new Error("Could not load this pack opening.");
  if (!data || data.length === 0) notFound();

  const cards = data as PackResultCard[];
  const photoUrls = await resolvePhotoUrls(
    supabase,
    cards.map((card) => card.photo_path),
  );

  const revealCards: RevealCard[] = cards.map((card) => ({
    cardId: card.card_id,
    // kut.my_pack_opening_results has no player_id or is_live yet, so a pack
    // result can't be cast. The ROADMAP "Plaster cast on every card" PR B adds
    // both and switches this to toLiveCardPlayer.
    player: { ...cardFace(card, card.ovr, photoUrls), id: null, injured: false },
  }));

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm font-bold text-ink-faint">
          Pack opening saved — the result was fixed before this reveal.
        </p>
        <PackReveal
          cards={revealCards}
          cardHrefBase="/club/collection/"
          doneHref="/club/collection"
          doneLabel="View Collection"
          secondaryHref="/club/packs"
          secondaryLabel="Open another"
          title={cards[0].pack_title}
        />
      </section>
    </main>
  );
}
