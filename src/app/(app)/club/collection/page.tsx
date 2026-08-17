import Link from "next/link";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

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

type CollectionPageProps = {
  searchParams: Promise<{ discard?: string; purchase?: string }>;
};

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
  await requireUser();
  const supabase = await createClient();
  const [{ data, error }, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, edition_id, edition_title, edition_type, is_live, is_tradeable, source, player_id, player_slug, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, active_listing_id")
      .order("ovr", { ascending: false })
      .order("display_name"),
    searchParams,
  ]);

  if (error) {
    throw new Error("Could not load your collection.");
  }

  const cards = (data ?? []) as CollectionCard[];
  const tradeableCount = cards.filter((card) => card.is_tradeable).length;

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">My club</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Collection</h1>
            <p className="mt-2 text-sm text-slate-400">{tradeableCount} tradeable · {cards.length - tradeableCount} locked</p>
          </div>
          <p className="rounded-full border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-300">Live cards update automatically</p>
        </header>

        {query.discard && Number.isSafeInteger(Number(query.discard)) && Number(query.discard) > 0 && (
          <p className="rounded-2xl border border-emerald-400/40 bg-emerald-950/50 p-4 font-bold text-emerald-100">
            Card discarded. {query.discard} KUT Coins were added to your wallet.
          </p>
        )}
        {query.purchase && Number.isSafeInteger(Number(query.purchase)) && Number(query.purchase) > 0 && (
          <p className="rounded-2xl border border-emerald-400/40 bg-emerald-950/50 p-4 font-bold text-emerald-100">Purchase complete. {query.purchase} KUT Coins were paid and the card is now in your collection.</p>
        )}

        {cards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
            <h2 className="text-xl font-black">Your collection is empty</h2>
            <p className="mt-2 text-slate-300">Open a pack to receive your first tradeable Live Cards.</p>
            <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-400 px-4 font-bold text-slate-950" href="/club/packs">Open a pack</Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
            {cards.map((card) => (
              <Link
                aria-label={`Open ${card.display_name}'s card`}
                className="group rounded-[1.25rem] outline-offset-4 outline-amber-400 focus-visible:outline-2"
                href={`/club/collection/${card.card_id}`}
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
