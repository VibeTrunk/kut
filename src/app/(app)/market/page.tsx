import Link from "next/link";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { BuyListingForm } from "./buy-listing-form";
import { ProposeOfferForm, type OfferableCard } from "./propose-offer-form";

type MarketPageProps = { searchParams: Promise<{ q?: string; rarity?: string; sort?: string; min?: string; max?: string }> };
type Listing = { listing_id: string; price: number; seller_id: string; seller_display_name: string; display_name: string; archetype: string; photo_path: string | null; ovr: number; pac: number; sho: number; pas: number; dri: number; def: number; phy: number; rarity_tier: LiveCardPlayer["rarityTier"] };
const rarities = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;

export default async function MarketPage({ searchParams }: MarketPageProps) {
  const user = await requireUser(); const supabase = await createClient(); const query = await searchParams;
  // Lazily retire trade offers past their 12h window (mirrors the listing lazy-expire).
  await supabase.schema("kut").rpc("expire_trade_offers");
  let request = supabase.schema("kut").from("active_market_listings").select("listing_id, price, seller_id, seller_display_name, display_name, archetype, photo_path, ovr, pac, sho, pas, dri, def, phy, rarity_tier");
  const term = query.q?.trim().slice(0, 80); if (term) request = request.ilike("display_name", `%${term}%`);
  if (rarities.includes(query.rarity as (typeof rarities)[number])) request = request.eq("rarity_tier", query.rarity);
  const min = Number(query.min); const max = Number(query.max); if (Number.isSafeInteger(min) && min >= 0) request = request.gte("price", min); if (Number.isSafeInteger(max) && max >= 0) request = request.lte("price", max);
  if (query.sort === "price") request = request.order("price"); else if (query.sort === "ovr") request = request.order("ovr", { ascending: false }); else request = request.order("listed_at", { ascending: false });
  const [{ data, error }, { data: wallet }, { data: ownCards }] = await Promise.all([
    request,
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, display_name, ovr, rarity_tier, active_listing_id, held_by_offer_id")
      .order("ovr", { ascending: false }),
  ]);
  if (error) throw new Error("Could not load the market.");
  const listings = (data ?? []) as Listing[]; const balance = wallet?.balance ?? 0;
  const photoUrls = await resolvePhotoUrls(supabase, listings.map((listing) => listing.photo_path));
  const offerableCards: OfferableCard[] = ((ownCards ?? []) as (OfferableCard & { active_listing_id: string | null; held_by_offer_id: string | null })[])
    .filter((card) => !card.active_listing_id && !card.held_by_offer_id)
    .map((card) => ({ card_id: card.card_id, display_name: card.display_name, ovr: card.ovr, rarity_tier: card.rarity_tier }));

  return <main className="min-h-screen bg-board p-5 text-ink sm:p-10"><section className="mx-auto max-w-6xl space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black uppercase tracking-[0.24em] text-brass">Transfer market</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Buy Live Cards</h1><p className="mt-3 text-ink-dim">Buy now, or make a coin-and-card offer. Buy-now prices are paid in KUT Coins; a 5% tax is burned.</p></div><Link className="min-h-11 rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-dim hover:border-brass hover:text-brass" href="/market/offers">Trade offers</Link></header>
    <form className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-5"><input className="min-h-11 rounded-xl bg-board px-3 sm:col-span-2" defaultValue={query.q} name="q" placeholder="Search player" /><select className="min-h-11 rounded-xl bg-board px-3" defaultValue={query.rarity} name="rarity"><option value="">Any tier</option>{rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}</select><select className="min-h-11 rounded-xl bg-board px-3" defaultValue={query.sort} name="sort"><option value="newest">Newest</option><option value="price">Price</option><option value="ovr">OVR</option></select><button className="min-h-11 rounded-xl border border-brass px-4 font-black text-brass" type="submit">Filter</button></form>
    {listings.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">No active listings match these filters. List a card from your Collection to start the market.</p> : <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,280px))] justify-center gap-5">{listings.map((listing) => {
      const isOwnListing = listing.seller_id === user.id;
      return <article className="w-full rounded-[1.25rem]" key={listing.listing_id}><LiveCard player={{ id: listing.listing_id, displayName: listing.display_name, archetype: listing.archetype, liveOvr: listing.ovr, pac: listing.pac, sho: listing.sho, pas: listing.pas, dri: listing.dri, def: listing.def, phy: listing.phy, rarityTier: listing.rarity_tier, photoUrl: listing.photo_path ? photoUrls.get(listing.photo_path) ?? null : null }} /><p className="mt-3 text-center text-sm font-semibold text-ink-faint">Sold by {listing.seller_display_name}</p><p className="mt-1 text-center text-xl font-black text-brass">{listing.price} KUT Coins</p>
        {isOwnListing ? <p className="mt-3 rounded-xl border border-line px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Your listing</p> : <><BuyListingForm canAfford={balance >= listing.price} listingId={listing.listing_id} price={listing.price} /><ProposeOfferForm askingPrice={listing.price} listingId={listing.listing_id} offerableCards={offerableCards} /></>}
      </article>;
    })}</div>}
  </section></main>;
}
