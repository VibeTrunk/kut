import { notFound } from "next/navigation";
import { PackReveal, type RevealCard } from "@/components/pack-reveal";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toListedCardPlayer, type ListedCardRow } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

type PackResultPageProps = { params: Promise<{ openingId: string }> };

type PackResultCard = ListedCardRow & {
  opening_id: string;
  opened_at: string;
  price_paid: number;
  pack_title: string;
  slot: number;
  card_id: string;
};

export default async function PackResultPage({ params }: PackResultPageProps) {
  await requireUser();
  const { openingId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    // "*" rather than a column list: ADR-086 appended player_id and is_live, and
    // the page ships before the hosted schema does.
    .from("my_pack_opening_results")
    .select("*")
    .eq("opening_id", openingId)
    .order("slot");

  if (error) throw new Error("Could not load this pack opening.");
  if (!data || data.length === 0) notFound();

  const cards = data as PackResultCard[];
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      cards.map((card) => card.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);

  const revealCards: RevealCard[] = cards.map((card) => ({
    cardId: card.card_id,
    player: toListedCardPlayer(card, injuredPlayerIds, photoUrls),
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
