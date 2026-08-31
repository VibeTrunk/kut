import Link from "next/link";
import { IconSearch, IconSort } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
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
  discard_value: number;
  active_listing_id: string | null;
  photo_path: string | null;
};

type CollectionPageProps = {
  searchParams: Promise<{ discard?: string; purchase?: string; q?: string; rarity?: string; sort?: string }>;
};

const RARITIES = ["elite", "holo", "gold", "silver", "bronze", "common"] as const;
const SORTS = {
  ovr: "Rating, high to low",
  name: "Name, A to Z",
  value: "Discard value",
} as const;
type SortKey = keyof typeof SORTS;

function href(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...patch })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/club/collection?${query}` : "/club/collection";
}

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
  await requireUser();
  const supabase = await createClient();
  const [{ data, error }, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, edition_id, edition_title, edition_type, is_live, source, player_id, player_slug, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, discard_value, active_listing_id, photo_path")
      .order("ovr", { ascending: false })
      .order("display_name"),
    searchParams,
  ]);

  if (error) {
    throw new Error("Could not load your collection.");
  }

  // A club's collection is tens of cards, not thousands, so the whole set is
  // fetched once and narrowed here: it keeps the header totals honest (they
  // describe the whole collection, not the current filter) in one round trip.
  const all = (data ?? []) as CollectionCard[];
  const term = query.q?.trim().slice(0, 80) ?? "";
  const rarity = RARITIES.includes(query.rarity as (typeof RARITIES)[number]) ? query.rarity : undefined;
  const sort: SortKey = query.sort && query.sort in SORTS ? (query.sort as SortKey) : "ovr";
  const base = { q: term || undefined, rarity, sort: sort === "ovr" ? undefined : sort };

  const cards = all
    .filter((card) => (rarity ? card.rarity_tier === rarity : true))
    .filter((card) => (term ? card.display_name.toLowerCase().includes(term.toLowerCase()) : true))
    .sort((a, b) =>
      sort === "name"
        ? a.display_name.localeCompare(b.display_name)
        : sort === "value"
          ? b.discard_value - a.discard_value
          : b.ovr - a.ovr || a.display_name.localeCompare(b.display_name),
    );

  const photoUrls = await resolvePhotoUrls(supabase, cards.map((card) => card.photo_path));
  const uniquePlayers = new Set(all.map((card) => card.player_id)).size;
  const discardValue = all.reduce((total, card) => total + (card.discard_value ?? 0), 0);
  const filtered = Boolean(term || rarity);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">My club</p>
            <h1 className="display text-5xl sm:text-6xl">Collection</h1>
            <p className="text-xs font-bold text-ink-faint">
              {all.length} {all.length === 1 ? "card" : "cards"} &middot; {uniquePlayers} unique{" "}
              {uniquePlayers === 1 ? "player" : "players"} &middot; {discardValue.toLocaleString()} KUT Coins of discard value
            </p>
          </div>
          <p className="rounded-full border border-line px-3.5 py-1.5 text-xs font-bold text-ink-dim">Live cards update automatically</p>
        </header>

        {query.discard && Number.isSafeInteger(Number(query.discard)) && Number(query.discard) > 0 && (
          <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 font-bold text-moss">
            Card discarded. {query.discard} KUT Coins were added to your wallet.
          </p>
        )}
        {query.purchase && Number.isSafeInteger(Number(query.purchase)) && Number(query.purchase) > 0 && (
          <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 font-bold text-moss">Purchase complete. {query.purchase} KUT Coins were paid and the card is now in your collection.</p>
        )}

        {all.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center">
            <h2 className="display text-3xl">Your collection is empty</h2>
            <p className="mt-3 text-ink-dim">Open a pack to receive your first Live Cards.</p>
            <Link className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 font-black text-ink-on-accent" href="/club/packs">Open a pack</Link>
          </div>
        ) : (
          <>
            {/* Collection now carries the same search / tier / sort vocabulary the
                Market always had, so the two grids stop behaving differently. */}
            <div className="flex flex-wrap items-center gap-3 border-b border-line/40 pb-6">
              <form action="/club/collection" className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-board-deep/60 px-3.5" >
                <IconSearch aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
                <input
                  aria-label="Search your cards"
                  className="w-44 bg-transparent text-sm font-semibold text-ink placeholder:text-ink-faint focus:outline-none"
                  defaultValue={term}
                  name="q"
                  placeholder="Search your cards"
                />
                {rarity && <input name="rarity" type="hidden" value={rarity} />}
                {sort !== "ovr" && <input name="sort" type="hidden" value={sort} />}
              </form>

              <Link
                className={`min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-extrabold capitalize ${
                  rarity ? "border-line bg-board-deep/50 text-ink-dim hover:text-ink" : "border-brass/50 bg-brass/12 text-brass"
                }`}
                href={href(base, { rarity: undefined })}
              >
                All tiers
              </Link>
              {RARITIES.map((tier) => (
                <Link
                  className={`min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-extrabold capitalize ${
                    rarity === tier ? "border-brass/50 bg-brass/12 text-brass" : "border-line bg-board-deep/50 text-ink-dim hover:text-ink"
                  }`}
                  href={href(base, { rarity: tier })}
                  key={tier}
                >
                  {tier}
                </Link>
              ))}

              <span className="grow" />

              <div className="flex items-center gap-1.5 rounded-xl border border-line bg-board-deep/60 px-2">
                <IconSort aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <Link
                    className={`min-h-11 px-2 py-2.5 text-xs font-bold ${sort === key ? "text-brass" : "text-ink-faint hover:text-ink"}`}
                    href={href(base, { sort: key === "ovr" ? undefined : key })}
                    key={key}
                  >
                    {SORTS[key]}
                  </Link>
                ))}
              </div>
            </div>

            {cards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
                No cards match these filters.{" "}
                <Link className="font-bold text-brass hover:underline" href="/club/collection">
                  Clear them
                </Link>
                .
              </p>
            ) : (
              <>
                {filtered && (
                  <p className="text-xs font-bold text-ink-faint">
                    {cards.length} of {all.length} shown
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
                  {cards.map((card) => (
                    <Link
                      aria-label={`Open ${card.display_name}'s card`}
                      className="group relative rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
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
                          photoUrl: card.photo_path ? photoUrls.get(card.photo_path) ?? null : null,
                        }}
                      />
                      {/* Status rides the card rather than floating as loose text
                          beneath it, so a scanned grid reads in one pass. */}
                      {card.active_listing_id && (
                        <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-brass/55 bg-board-deep/90 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-brass backdrop-blur-sm">
                          Listed
                        </span>
                      )}
                      {!card.is_live && (
                        <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-board-deep/90 px-3 py-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-ink-dim backdrop-blur-sm">
                          {card.edition_title}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
