import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributeBars } from "@/components/card-stats";
import { IconCoin } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { archetypeLabel } from "@/game/archetypes";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { BuyListingForm } from "../buy-listing-form";
import { ProposeOfferForm, type OfferableCard } from "../propose-offer-form";

export const metadata = { title: "Listing" };

type ListingPageProps = { params: Promise<{ listingId: string }> };

type Listing = {
  listing_id: string;
  price: number;
  seller_id: string;
  seller_display_name: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
};

/**
 * One listing, full width. The market grid is two columns on a phone (KB-006), far
 * too narrow for the coin input and card list an offer needs, so this page is where
 * a coin-and-card offer is built (ADR-051). Buy-now is here too, so the grid tile
 * stays a card, a price and one button.
 */
export default async function ListingPage({ params }: ListingPageProps) {
  const user = await requireUser();
  const { listingId } = await params;
  // A malformed id (a stray path segment) fails the `uuid` cast below with a
  // query error instead of the intended "not found" (KB-007).
  if (!isUuid(listingId)) notFound();
  const supabase = await createClient();

  // Mirrors the market index: retire offers past their 12h window before reading.
  await supabase.schema("kut").rpc("expire_trade_offers");

  const [{ data, error }, { data: wallet }, { data: ownCards }] = await Promise.all([
    supabase
      .schema("kut")
      .from("active_market_listings")
      .select(
        "listing_id, price, seller_id, seller_display_name, display_name, archetype, photo_path, ovr, pac, sho, pas, dri, def, phy, rarity_tier",
      )
      .eq("listing_id", listingId)
      .maybeSingle(),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, display_name, ovr, rarity_tier, active_listing_id, held_by_offer_id")
      .order("ovr", { ascending: false }),
  ]);

  if (error) throw new Error("Could not load this listing.");
  // Sold, cancelled and expired listings all drop out of the view, so this 404s them
  // rather than rendering a dead Buy button.
  if (!data) notFound();

  const listing = data as Listing;
  const balance = wallet?.balance ?? 0;
  const isOwnListing = listing.seller_id === user.id;
  const photoUrls = await resolvePhotoUrls(supabase, [listing.photo_path]);

  const offerableCards: OfferableCard[] = ((ownCards ?? []) as (OfferableCard & {
    active_listing_id: string | null;
    held_by_offer_id: string | null;
  })[])
    .filter((card) => !card.active_listing_id && !card.held_by_offer_id)
    .map((card) => ({ card_id: card.card_id, display_name: card.display_name, ovr: card.ovr, rarity_tier: card.rarity_tier }));

  const cardPlayer: LiveCardPlayer = {
    id: listing.listing_id,
    displayName: listing.display_name,
    archetype: listing.archetype,
    liveOvr: listing.ovr,
    pac: listing.pac,
    sho: listing.sho,
    pas: listing.pas,
    dri: listing.dri,
    def: listing.def,
    phy: listing.phy,
    rarityTier: listing.rarity_tier,
    photoUrl: listing.photo_path ? photoUrls.get(listing.photo_path) ?? null : null,
  };

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/market">
          &larr; Market
        </Link>

        <div className="grid gap-10 pb-24 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start sm:pb-0 lg:gap-16">
          <div>
            <LiveCard size="detail" player={cardPlayer} />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
                {archetypeLabel(listing.archetype)} &middot; <span className="capitalize">{listing.rarity_tier}</span> &middot;{" "}
                {listing.ovr} OVR
              </p>
              <h1 className="display text-3xl sm:text-6xl">{listing.display_name}</h1>
              <p className="flex items-center gap-2 text-3xl font-black tabular-nums text-brass">
                <IconCoin aria-hidden="true" className="h-6 w-6" />
                {listing.price.toLocaleString()}
                <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink-dim">KUT Coins</span>
              </p>
              <p className="text-sm font-bold text-ink-faint">Sold by {listing.seller_display_name}</p>
            </div>

            <AttributeBars player={listing} />

            <hr className="border-line/40" />

            {isOwnListing ? (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm font-bold text-ink-faint">
                This is your listing. Cancel it from this card in your Collection.
              </p>
            ) : (
              <div className="space-y-6">
                {/* On a phone the detail card is ~460px tall, so Buy sat below the
                    fold under the name, the attribute bars and a rule. It is
                    pinned above the tab bar instead — rendered once, never
                    duplicated, so there is no second submit path. At `sm` it
                    returns to the flow beside the card, where there is room.
                    The card page next door keeps its actions in the flow: List
                    and Discard are panels with an input and a confirm, not one
                    button, and will not fit a bar. */}
                <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-line/60 bg-board-deep/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                  <BuyListingForm canAfford={balance >= listing.price} listingId={listing.listing_id} price={listing.price} />
                </div>

                <div className="space-y-3">
                  <h2 className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                    Or make an offer
                  </h2>
                  <ProposeOfferForm
                    askingPrice={listing.price}
                    listingId={listing.listing_id}
                    offerableCards={offerableCards}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
