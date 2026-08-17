import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type PackResultPageProps = { params: Promise<{ openingId: string }> };

type PackResultCard = {
  opening_id: string;
  opened_at: string;
  price_paid: number;
  pack_title: string;
  slot: number;
  card_id: string;
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
};

export default async function PackResultPage({ params }: PackResultPageProps) {
  await requireUser();
  const { openingId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_pack_opening_results")
    .select("opening_id, opened_at, price_paid, pack_title, slot, card_id, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier")
    .eq("opening_id", openingId)
    .order("slot");

  if (error) throw new Error("Could not load this pack opening.");
  if (!data || data.length === 0) notFound();

  const cards = data as PackResultCard[];
  const pack = cards[0];

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <p className="text-sm font-bold text-slate-400">Pack opening saved</p>
        <header className="rounded-3xl border border-amber-400/40 bg-[radial-gradient(circle_at_top,_#78350f,_#111827_62%)] p-7 text-center shadow-2xl shadow-amber-950/40">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-300">{pack.pack_title}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Your new Live Cards</h1>
          <p className="mt-3 text-slate-200">Three tradeable cards were selected and saved before this reveal.</p>
        </header>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-5">
          {cards.map((card) => (
            <Link className="rounded-[1.25rem] outline-offset-4 outline-amber-400 focus-visible:outline-2" href={`/club/collection/${card.card_id}`} key={card.card_id}>
              <LiveCard player={{ id: card.card_id, displayName: card.display_name, archetype: card.archetype, liveOvr: card.ovr, pac: card.pac, sho: card.sho, pas: card.pas, dri: card.dri, def: card.def, phy: card.phy, rarityTier: card.rarity_tier }} />
              <span className="mt-2 block text-center text-xs font-black uppercase tracking-[0.13em] text-emerald-300">Tradeable · view card</span>
            </Link>
          ))}
        </div>
        <div className="flex justify-center"><Link className="inline-flex min-h-12 items-center rounded-xl bg-amber-400 px-5 font-black text-slate-950" href="/club/collection">View Collection</Link></div>
      </section>
    </main>
  );
}
