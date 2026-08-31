import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { OpenPackForm } from "./open-pack-form";

type PackOffer = { slug: string; title: string; price: number; cards_per_pack: number };

/** Mirrors the live-rating tier thresholds the database applies on publish. */
const TIER_BANDS = [
  ["common", "Common", "under 40"],
  ["bronze", "Bronze", "40 to 49"],
  ["silver", "Silver", "50 to 59"],
  ["gold", "Gold", "60 to 69"],
  ["holo", "Holo", "70 to 79"],
  ["elite", "Elite", "80 and up"],
] as const;

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
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Pack store</p>
          <h1 className="display text-5xl sm:text-6xl">Packs</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Spend KUT Coins on server-selected Live Cards. You have {balance.toLocaleString()} KUT Coins.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {packs.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
              No packs are available right now.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
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
            </div>
          )}

          <aside className="rounded-2xl border border-line/60 bg-panel/60 p-6">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">What is in the ladder</p>
            <dl className="mt-4">
              {TIER_BANDS.map(([tier, label, band]) => (
                <div className="flex items-center gap-3.5 border-b border-line/30 py-3" key={tier}>
                  <span aria-hidden="true" className="tier-chip" data-rarity={tier}>
                    <span className={`live-card__tier-icon--${tier}`} />
                  </span>
                  <dt className="grow text-sm font-extrabold">{label}</dt>
                  <dd className="text-xs font-bold tabular-nums text-ink-faint">OVR {band}</dd>
                </div>
              ))}
            </dl>
            <p className="pt-4 text-xs leading-relaxed text-ink-faint">
              Tier follows the card&rsquo;s live rating, so a card can climb the ladder without you doing anything.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
