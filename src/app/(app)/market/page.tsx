import Link from "next/link";
import { IconCoin } from "@/components/icons";
import { FilterBar } from "@/components/filter-bar";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { getNavContext } from "@/lib/nav/context";
import { buildMarketTabs } from "@/lib/nav/routes";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { BuyListingForm } from "./buy-listing-form";

type MarketPageProps = { searchParams: Promise<{ q?: string; rarity?: string; sort?: string; min?: string; max?: string }> };

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

const rarities = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;
const TIER_OPTIONS = rarities.map((tier) => ({ value: tier, label: tier[0].toUpperCase() + tier.slice(1) }));
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "ovr", label: "OVR" },
];

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const query = await searchParams;

  // Lazily retire trade offers past their 12h window (mirrors the listing lazy-expire).
  await supabase.schema("kut").rpc("expire_trade_offers");

  let request = supabase
    .schema("kut")
    .from("active_market_listings")
    .select("listing_id, price, seller_id, seller_display_name, display_name, archetype, photo_path, ovr, pac, sho, pas, dri, def, phy, rarity_tier");

  const term = query.q?.trim().slice(0, 80);
  if (term) request = request.ilike("display_name", `%${term}%`);
  if (rarities.includes(query.rarity as (typeof rarities)[number])) request = request.eq("rarity_tier", query.rarity);

  const min = Number(query.min);
  const max = Number(query.max);
  if (Number.isSafeInteger(min) && min >= 0) request = request.gte("price", min);
  if (Number.isSafeInteger(max) && max >= 0) request = request.lte("price", max);

  if (query.sort === "price") request = request.order("price");
  else if (query.sort === "ovr") request = request.order("ovr", { ascending: false });
  else request = request.order("listed_at", { ascending: false });

  // The offerable-cards query used to live here for the per-tile offer form. Offers
  // moved to the listing detail page (ADR-051), so the index no longer pays for it.
  const [{ data, error }, { data: wallet }] = await Promise.all([
    request,
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  if (error) throw new Error("Could not load the market.");

  const listings = (data ?? []) as Listing[];
  const balance = wallet?.balance ?? 0;
  const photoUrls = await resolvePhotoUrls(supabase, listings.map((listing) => listing.photo_path));
  // getNavContext is React.cache()d and the (app) layout already called it this
  // request, so this is free and guarantees the tab badge matches the chrome one.
  const { incomingOfferCount } = await getNavContext();
  const marketTabs = buildMarketTabs(incomingOfferCount);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Transfer market</p>
          {/* "Market" everywhere — the tab, this heading and the back link from a
              listing. The old "Buy Live Cards" named an action rather than a place,
              and now sits above a tab that also says Buy (ADR-053). */}
          <h1 className="display text-3xl sm:text-6xl">Market</h1>
          <p className="hidden max-w-2xl text-base leading-relaxed text-ink-dim sm:block">
            Buy now, or make a coin-and-card offer. Buy-now prices are paid in KUT Coins; a 5% tax is burned.
          </p>
        </header>

        <SectionTabs label="Market" tabs={marketTabs} />

        {/* The six controls used to stack full width on a phone (~352px), which
            pushed the first listing below the fold; KB-008 cut that to a
            two-column grid at ~232px. They now collapse to a Filters pill and a
            sheet instead, so the bar costs one row at every width, and the price
            bounds get the sheet's Apply button — the one control here that
            genuinely wants a submit. */}
        <FilterBar
          basePath="/market"
          chips={{ name: "rarity", allLabel: "All tiers", options: TIER_OPTIONS }}
          defaultSort="newest"
          range={{ minName: "min", maxName: "max", minLabel: "Min", maxLabel: "Max" }}
          searchPlaceholder="Search player"
          sorts={SORT_OPTIONS}
          values={{ q: query.q, rarity: query.rarity, sort: query.sort, min: query.min, max: query.max }}
        />

        {listings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-ink-dim">
            No active listings match these filters. List a card from your Collection to start the market.
          </p>
        ) : (
          /* Two columns on a phone, matching Home's riser grid — one listing per
             screen made the market unbrowsable on mobile (KB-006). */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => {
              const isOwnListing = listing.seller_id === user.id;
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
                <article className="flex flex-col gap-2.5" key={listing.listing_id}>
                  <div className="relative">
                    {/* The card is the way into the listing: offers, and the full
                        stat breakdown, live on its detail page (ADR-051). */}
                    <Link
                      aria-label={`${listing.display_name} — open this listing`}
                      className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                      href={`/market/${listing.listing_id}`}
                    >
                      <LiveCard player={cardPlayer} />
                    </Link>
                    {/* Price rides the card: a market grid is scanned by price. */}
                    <p className="absolute left-1/2 top-2.5 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-brass/55 bg-board-deep/90 px-3 py-1 text-xs font-black tabular-nums text-brass backdrop-blur-sm">
                      <IconCoin aria-hidden="true" className="h-3 w-3" />
                      {listing.price.toLocaleString()}
                    </p>
                  </div>

                  <p className="truncate text-[0.7rem] font-bold text-ink-faint">Sold by {listing.seller_display_name}</p>

                  {isOwnListing ? (
                    <p className="grid min-h-11 place-items-center rounded-xl border border-dashed border-line text-[0.65rem] font-black uppercase tracking-[0.12em] text-ink-faint">
                      Your listing
                    </p>
                  ) : (
                    <BuyListingForm canAfford={balance >= listing.price} listingId={listing.listing_id} price={listing.price} />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
