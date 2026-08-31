import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributeBars } from "@/components/card-stats";
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
  held_by_offer_id: string | null;
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
    .select("card_id, edition_id, edition_title, edition_type, is_live, source, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, discard_value, active_listing_id, active_listing_price, held_by_offer_id, photo_path")
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
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/club/collection">
          &larr; Collection
        </Link>

        <div className="grid gap-10 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start lg:gap-16">
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

          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
                {card.is_live ? "Live card" : "Special card"} &middot; <span className="capitalize">{card.rarity_tier}</span>
              </p>
              <h1 className="display text-5xl sm:text-6xl">{card.display_name}</h1>
              <p className="text-base text-ink-dim">
                {card.is_live
                  ? "This card’s rating is live and changes with published football sessions."
                  : card.edition_title}
              </p>
            </div>

            <AttributeBars player={card} />

            <hr className="border-line/40" />

            <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">Edition</dt>
                <dd className="mt-1.5 text-lg font-black">{readable(card.edition_type)}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">Source</dt>
                <dd className="mt-1.5 text-lg font-black">{readable(card.source)}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">Discard value</dt>
                <dd className="mt-1.5 text-lg font-black tabular-nums">{card.discard_value} KUT Coins</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">Card ID</dt>
                <dd className="mt-1.5 break-all font-mono text-xs text-ink-dim">{card.card_id}</dd>
              </div>
            </dl>

            {query.listed === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-sm font-bold text-moss">
                Listed successfully. This card is now locked for 24 hours or until you cancel it.
              </p>
            )}
            {query.listingCancelled === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-sm font-bold text-moss">
                Listing cancelled. This card is available again.
              </p>
            )}

            {card.held_by_offer_id && (
              <p className="rounded-2xl border border-brass/40 bg-brass/10 p-4 text-sm font-bold text-brass">
                This card is committed to a pending trade offer. It can&rsquo;t be listed or discarded until that
                offer is accepted, declined, or expires.
              </p>
            )}
            {!card.held_by_offer_id && card.active_listing_id && card.active_listing_price && (
              <CancelListingForm cardId={card.card_id} listingId={card.active_listing_id} price={card.active_listing_price} />
            )}
            {!card.held_by_offer_id && !card.active_listing_id && (
              <>
                {minimumPrice !== null && maximumPrice !== null && (
                  <CreateListingForm cardId={card.card_id} maximumPrice={maximumPrice} minimumPrice={minimumPrice} />
                )}
                <DiscardCardForm cardId={card.card_id} discardValue={card.discard_value} />
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
