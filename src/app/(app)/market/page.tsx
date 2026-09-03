import Link from "next/link";
import { IconCoin, IconOffer, IconSearch } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
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
const fieldClass = "min-h-11 rounded-xl border border-line bg-board-deep/60 px-3.5 text-sm font-semibold text-ink placeholder:text-ink-faint focus:border-brass/60 focus:outline-none";

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

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Transfer market</p>
            <h1 className="display text-5xl sm:text-6xl">Buy Live Cards</h1>
            <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
              Buy now, or make a coin-and-card offer. Buy-now prices are paid in KUT Coins; a 5% tax is burned.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-dim hover:border-brass hover:text-brass"
            href="/market/offers"
          >
            <IconOffer aria-hidden="true" className="h-4 w-4" />
            Trade offers
          </Link>
        </header>

        {/* Six stacked full-width controls cost ~352px on a phone — more than the
            viewport had left after the page header, so the first listing sat below
            the fold. Two columns instead: search across the top, the two selects
            paired, the price bounds paired, then Filter. Four rows, ~230px. DOM
            order groups them the same way the rows do, so the `lg:` track order
            follows it (sort ahead of the price pair). */}
        <form className="grid grid-cols-2 gap-2.5 rounded-2xl border border-line/60 bg-board-deep/40 p-3 sm:gap-3 sm:p-3.5 lg:grid-cols-[minmax(0,1fr)_10rem_9rem_7rem_7rem_auto]">
          <label className={`${fieldClass} col-span-2 flex items-center gap-2 lg:col-span-1`}>
            <IconSearch aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              aria-label="Search player"
              className="w-full bg-transparent focus:outline-none"
              defaultValue={query.q}
              name="q"
              placeholder="Search player"
            />
          </label>
          <select aria-label="Tier" className={`${fieldClass} capitalize`} defaultValue={query.rarity} name="rarity">
            <option value="">Any tier</option>
            {rarities.map((rarity) => (
              <option className="capitalize" key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
          <select aria-label="Sort" className={fieldClass} defaultValue={query.sort} name="sort">
            <option value="newest">Newest</option>
            <option value="price">Price</option>
            <option value="ovr">OVR</option>
          </select>
          <input aria-label="Minimum price" className={fieldClass} defaultValue={query.min} inputMode="numeric" name="min" placeholder="Min" />
          <input aria-label="Maximum price" className={fieldClass} defaultValue={query.max} inputMode="numeric" name="max" placeholder="Max" />
          <button className="col-span-2 min-h-11 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-sm font-black text-ink-on-accent hover:brightness-105 lg:col-span-1" type="submit">
            Filter
          </button>
        </form>

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
