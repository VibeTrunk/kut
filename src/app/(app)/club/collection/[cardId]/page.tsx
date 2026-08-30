import { notFound } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { DiscardCardForm } from "../discard-card-form";
import { CreateListingForm } from "../create-listing-form";
import { CancelListingForm } from "../cancel-listing-form";

type CardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ listed?: string; listingCancelled?: string }>;
};

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
  source: string;
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
  discard_value: number;
  active_listing_id: string | null;
  active_listing_price: number | null;
  photo_path: string | null;
};

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function CardDetailPage({ params, searchParams }: CardPageProps) {
  await requireUser();
  const { cardId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select("card_id, edition_id, edition_title, edition_type, is_live, source, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, discard_value, active_listing_id, active_listing_price, photo_path")
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load this card.");
  }

  if (!data) {
    notFound();
  }

  const card = data as CollectionCard;
  const photoUrls = await resolvePhotoUrls(supabase, [card.photo_path]);
  const [query, boundsResponse] = await Promise.all([
    searchParams,
    !card.active_listing_id
      ? supabase.schema("kut").rpc("get_listing_bounds", { p_card_id: card.card_id })
      : Promise.resolve({ data: null, error: null }),
  ]);
  const bounds = boundsResponse.data && typeof boundsResponse.data === "object" ? boundsResponse.data : null;
  const minimumPrice = bounds && "minimum_price" in bounds ? Number(bounds.minimum_price) : null;
  const maximumPrice = bounds && "maximum_price" in bounds ? Number(bounds.maximum_price) : null;

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Collection</p>

        <div className="grid gap-8 rounded-3xl border border-line/80 bg-panel/70 p-6 sm:p-8 md:grid-cols-[minmax(280px,360px)_1fr] md:items-center">
          <LiveCard
            size="detail"
            player={{
              id: card.card_id,
              displayName: card.display_name,
              archetype: card.archetype,
              liveOvr: card.ovr,
              pac: card.pac,
              sho: card.sho,
              pas: card.pas,
              dri: card.dri,
              def: card.def,
              phy: card.phy,
              rarityTier: card.rarity_tier,
              photoUrl: card.photo_path ? photoUrls.get(card.photo_path) ?? null : null,
            }}
          />

          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">{card.is_live ? "Live card" : "Special card"}</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">{card.display_name}</h1>
              <p className="mt-2 text-lg text-ink-dim">{card.is_live ? "This card’s rating is live and changes with published football sessions." : card.edition_title}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-board/60 p-4">
                <dt className="font-bold uppercase tracking-[0.12em] text-ink-faint">Edition</dt>
                <dd className="mt-1 text-lg font-black">{readable(card.edition_type)}</dd>
              </div>
              <div className="rounded-2xl bg-board/60 p-4">
                <dt className="font-bold uppercase tracking-[0.12em] text-ink-faint">Source</dt>
                <dd className="mt-1 text-lg font-black">{readable(card.source)}</dd>
              </div>
              <div className="rounded-2xl bg-board/60 p-4">
                <dt className="font-bold uppercase tracking-[0.12em] text-ink-faint">Card ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-ink-dim">{card.card_id}</dd>
              </div>
              <div className="rounded-2xl bg-board/60 p-4">
                <dt className="font-bold uppercase tracking-[0.12em] text-ink-faint">Discard value</dt>
                <dd className="mt-1 text-lg font-black">{card.discard_value} KUT Coins</dd>
              </div>
            </dl>

            {query.listed === "1" && <p className="rounded-2xl bg-moss-bg p-4 text-sm font-bold text-moss">Listed successfully. This card is now locked for 24 hours or until you cancel it.</p>}
            {query.listingCancelled === "1" && <p className="rounded-2xl bg-moss-bg p-4 text-sm font-bold text-moss">Listing cancelled. This card is available again.</p>}

            {card.active_listing_id && card.active_listing_price && <CancelListingForm cardId={card.card_id} listingId={card.active_listing_id} price={card.active_listing_price} />}
            {!card.active_listing_id && <>
              {minimumPrice !== null && maximumPrice !== null && <CreateListingForm cardId={card.card_id} maximumPrice={maximumPrice} minimumPrice={minimumPrice} />}
              <DiscardCardForm cardId={card.card_id} discardValue={card.discard_value} />
            </>}
          </div>
        </div>
      </section>
    </main>
  );
}
