import Link from "next/link";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { OpenPackForm } from "./packs/open-pack-form";

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
  is_tradeable: boolean;
  source: string;
  player_id: string;
  player_slug: string;
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
  active_listing_id: string | null;
};

type ClubPageProps = {
  searchParams: Promise<{ discard?: string; purchase?: string }>;
};

type PackOffer = { slug: string; title: string; price: number; cards_per_pack: number };
type ClubValue = { card_value: number; club_value: number; unique_player_count: number };

export default async function ClubPage({ searchParams }: ClubPageProps) {
  const user = await requireUser();
  const supabase = await createClient();
  const [cardsResponse, walletResponse, packsResponse, clubValueResponse, notificationsResponse, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, edition_id, edition_title, edition_type, is_live, is_tradeable, source, player_id, player_slug, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, active_listing_id")
      .order("ovr", { ascending: false })
      .order("display_name"),
    supabase
      .schema("kut")
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.schema("kut").from("active_pack_offers").select("slug, title, price, cards_per_pack").order("price"),
    supabase.schema("kut").from("my_club_value").select("card_value, club_value, unique_player_count").maybeSingle(),
    supabase.schema("kut").from("user_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    searchParams,
  ]);

  if (cardsResponse.error || walletResponse.error || packsResponse.error || clubValueResponse.error || notificationsResponse.error) {
    throw new Error("Could not load your club.");
  }

  const cards = (cardsResponse.data ?? []) as CollectionCard[];
  const balance = walletResponse.data?.balance ?? 0;
  const tradeableCount = cards.filter((card) => card.is_tradeable).length;
  const packs = (packsResponse.data ?? []) as PackOffer[];
  const clubValue = clubValueResponse.data as ClubValue | null;
  const unreadMessages = notificationsResponse.count ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="flex justify-end"><LogoutButton /></div>
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
          <Link className="text-amber-400 hover:text-amber-300" href="/">← Live ratings</Link>
          <span className="text-slate-400">KUT · My Club</span>
        </nav>
        <div className="flex flex-wrap gap-4 text-sm font-bold">
          <Link className="inline-flex w-fit text-cyan-300 hover:text-cyan-200" href="/market">Browse the transfer market →</Link>
          <Link className="inline-flex w-fit text-cyan-300 hover:text-cyan-200" href="/leaderboard">Club Value leaderboard →</Link>
          <Link className="inline-flex w-fit text-cyan-300 hover:text-cyan-200" href="/messages">Messages{unreadMessages > 0 ? ` (${unreadMessages} new)` : ""} →</Link>
        </div>

        <header className="grid gap-4 rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">My club</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{user.displayName}</h1>
            <p className="mt-3 max-w-2xl text-slate-300">Your Live Cards change as their players’ published attendance changes. Every copy shown here belongs only to you.</p>
          </div>
          <dl className="flex flex-wrap gap-3 sm:justify-end">
            <div className="min-w-28 rounded-2xl bg-amber-400 px-4 py-3 text-slate-950">
              <dt className="text-xs font-black uppercase tracking-[0.13em]">KUT Coins</dt>
              <dd className="mt-1 text-2xl font-black">{balance}</dd>
            </div>
            <div className="min-w-28 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">Cards</dt>
              <dd className="mt-1 text-2xl font-black">{cards.length}</dd>
            </div>
            <div className="min-w-28 rounded-2xl border border-cyan-400/40 bg-cyan-950/30 px-4 py-3">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-cyan-200">Club Value</dt>
              <dd className="mt-1 text-2xl font-black text-cyan-100">{Number(clubValue?.club_value ?? balance).toLocaleString()}</dd>
            </div>
          </dl>
        </header>

        <p className="text-sm text-slate-400">{Number(clubValue?.card_value ?? 0).toLocaleString()} KUT Coins in card reference value across {clubValue?.unique_player_count ?? 0} unique players.</p>

        {query.discard && Number.isSafeInteger(Number(query.discard)) && Number(query.discard) > 0 && (
          <p className="rounded-2xl border border-emerald-400/40 bg-emerald-950/50 p-4 font-bold text-emerald-100">
            Card discarded. {query.discard} KUT Coins were added to your wallet.
          </p>
        )}
        {query.purchase && Number.isSafeInteger(Number(query.purchase)) && Number(query.purchase) > 0 && (
          <p className="rounded-2xl border border-emerald-400/40 bg-emerald-950/50 p-4 font-bold text-emerald-100">Purchase complete. {query.purchase} KUT Coins were paid and the card is now in your collection.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Collection</h2>
            <p className="mt-1 text-sm text-slate-400">{tradeableCount} tradeable · {cards.length - tradeableCount} locked</p>
          </div>
          <p className="rounded-full border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-300">Live cards update automatically</p>
        </div>

        {packs.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => (
              <OpenPackForm
                balance={balance}
                canAfford={balance >= pack.price}
                cardsPerPack={pack.cards_per_pack}
                key={pack.slug}
                packSlug={pack.slug}
                price={pack.price}
                title={pack.title}
              />
            ))}
          </section>
        )}

        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
            <h2 className="text-xl font-black">Your collection is empty</h2>
            <p className="mt-2 text-slate-300">Claim a starter pack from Live Ratings to receive your first three cards.</p>
            <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-400 px-4 font-bold text-slate-950" href="/">Go to Live Ratings</Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
            {cards.map((card) => (
              <Link
                aria-label={`Open ${card.display_name}'s card`}
                className="group rounded-[1.25rem] outline-offset-4 outline-amber-400 focus-visible:outline-2"
                href={`/club/cards/${card.card_id}`}
                key={card.card_id}
              >
                <LiveCard
                  player={{
                    id: card.player_id,
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
                  }}
                />
                <span className="mt-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-400 group-hover:text-amber-300">
                  <span>{card.is_live ? "Live edition" : card.edition_title}</span>
                  <span>{card.active_listing_id ? "Listed" : card.is_tradeable ? "Tradeable" : "Locked"}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
