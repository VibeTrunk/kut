import { notFound } from "next/navigation";
import { PackReveal, type RevealCard } from "@/components/pack-reveal";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toListedCardPlayer, type ListedCardRow } from "@/lib/live-card-player";
import { packSummary } from "@/lib/pack-summary";
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
  const [photoUrls, injuredPlayerIds, ownedResponse, rosterResponse] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      cards.map((card) => card.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
    supabase.schema("kut").from("my_collection_cards").select("card_id, player_id, discard_value"),
    // The album's slot order (`buildSlots`): by name, then id.
    supabase.schema("kut").from("player_directory").select("id, display_name"),
  ]);
  // The chips are a nicety: a failed read shows the cards without them.
  const summary =
    ownedResponse.error || rosterResponse.error
      ? null
      : packSummary({
          opened: cards.map((card) => ({
            card_id: card.card_id,
            player_id: card.player_id ?? null,
          })),
          owned: (ownedResponse.data ?? []) as {
            card_id: string;
            player_id: string;
            discard_value: number;
          }[],
          roster: ((rosterResponse.data ?? []) as { id: string; display_name: string }[])
            .sort(
              (a, b) => a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id),
            )
            .map((player) => player.id),
        });

  const revealCards: RevealCard[] = cards.map((card, index) => ({
    cardId: card.card_id,
    player: toListedCardPlayer(card, injuredPlayerIds, photoUrls),
    chip: summary?.chips[index]?.text ?? null,
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
          summaryLine={summary?.line}
          title={cards[0].pack_title}
        />
      </section>
    </main>
  );
}
