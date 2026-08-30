import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type ClubValue = { card_value: number; club_value: number; unique_player_count: number };

export default async function ClubPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [walletResponse, clubValueResponse, cardCountResponse] = await Promise.all([
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("card_value, club_value, unique_player_count").maybeSingle(),
    supabase.schema("kut").from("my_collection_cards").select("card_id", { count: "exact", head: true }),
  ]);

  if (walletResponse.error || clubValueResponse.error || cardCountResponse.error) {
    throw new Error("Could not load your club.");
  }

  const balance = walletResponse.data?.balance ?? 0;
  const clubValue = clubValueResponse.data as ClubValue | null;
  const cardCount = cardCountResponse.count ?? 0;

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">My club</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{user.displayName}</h1>
          <p className="mt-3 max-w-2xl text-ink-dim">Your club&apos;s standing across every Live Card you own. Open Collection to browse individual cards, or Packs to add more.</p>
        </header>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl bg-brass px-4 py-4 text-ink-on-accent">
            <dt className="text-xs font-black uppercase tracking-[0.13em]">KUT Coins</dt>
            <dd className="mt-1 text-2xl font-black">{balance.toLocaleString()}</dd>
          </div>
          <div className="rounded-2xl border border-steel-line/40 bg-steel-bg/30 px-4 py-4">
            <dt className="text-xs font-black uppercase tracking-[0.13em] text-steel">Club Value</dt>
            <dd className="mt-1 text-2xl font-black text-steel">{Number(clubValue?.club_value ?? balance).toLocaleString()}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-board/60 px-4 py-4">
            <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Cards</dt>
            <dd className="mt-1 text-2xl font-black">{cardCount}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-board/60 px-4 py-4">
            <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Unique players</dt>
            <dd className="mt-1 text-2xl font-black">{clubValue?.unique_player_count ?? 0}</dd>
          </div>
        </dl>

        <p className="text-sm text-ink-faint">{Number(clubValue?.card_value ?? 0).toLocaleString()} KUT Coins in card reference value across {clubValue?.unique_player_count ?? 0} unique players.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link className="group rounded-3xl border border-line bg-panel/70 p-6 hover:border-brass" href="/club/collection">
            <h2 className="text-xl font-black group-hover:text-brass">Browse Collection →</h2>
            <p className="mt-2 text-sm text-ink-faint">Every Live Card and special edition you own, {cardCount} in total.</p>
          </Link>
          <Link className="group rounded-3xl border border-line bg-panel/70 p-6 hover:border-brass" href="/club/packs">
            <h2 className="text-xl font-black group-hover:text-brass">Open Packs →</h2>
            <p className="mt-2 text-sm text-ink-faint">Spend KUT Coins on new Live Cards.</p>
          </Link>
        </div>

        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm text-ink-faint">
          Squad building is planned for a future season — this tab will grow to include your matchday lineup.
        </p>
      </section>
    </main>
  );
}
