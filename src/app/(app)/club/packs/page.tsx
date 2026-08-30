import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { OpenPackForm } from "./open-pack-form";

type PackOffer = { slug: string; title: string; price: number; cards_per_pack: number };

export default async function PacksPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [packsResponse, walletResponse] = await Promise.all([
    supabase.schema("kut").from("active_pack_offers").select("slug, title, price, cards_per_pack").order("price"),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  if (packsResponse.error || walletResponse.error) {
    throw new Error("Could not load the pack store.");
  }

  const packs = (packsResponse.data ?? []) as PackOffer[];
  const balance = walletResponse.data?.balance ?? 0;

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Pack store</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Packs</h1>
          <p className="mt-3 max-w-2xl text-ink-dim">Spend KUT Coins on server-selected Live Cards. You have {balance.toLocaleString()} KUT Coins.</p>
        </header>

        {packs.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">No packs are available right now.</p>
        ) : (
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
      </section>
    </main>
  );
}
