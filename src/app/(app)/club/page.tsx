import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type ClubValue = { owned_cards_value: number; personal_card_bonus: number; club_value: number; unique_player_count: number };

export default async function ClubPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [walletResponse, clubValueResponse, cardCountResponse] = await Promise.all([
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("owned_cards_value, personal_card_bonus, club_value, unique_player_count").maybeSingle(),
    supabase.schema("kut").from("my_collection_cards").select("card_id", { count: "exact", head: true }),
  ]);

  if (walletResponse.error || clubValueResponse.error || cardCountResponse.error) {
    throw new Error("Could not load your club.");
  }

  const balance = walletResponse.data?.balance ?? 0;
  const clubValue = clubValueResponse.data as ClubValue | null;
  const cardCount = cardCountResponse.count ?? 0;

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-10 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">My club</p>
          <h1 className="display text-5xl sm:text-6xl">{user.displayName}</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Your club&rsquo;s standing across every Live Card you own. Open Collection to browse individual cards, or Packs to add more.
          </p>
        </header>

        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-panel-2/70 to-panel/70 sm:grid-cols-4">
          <div className="border-b border-line/50 px-5 py-5 sm:border-b-0">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">KUT Coins</dt>
            <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-brass">{balance.toLocaleString()}</dd>
          </div>
          <Link className="group border-b border-l border-line/50 px-5 py-5 sm:border-b-0" href="/club/value">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-steel">Club Value</dt>
            <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-steel">
              {Number(clubValue?.club_value ?? balance).toLocaleString()}
            </dd>
            <dd className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-steel/70 group-hover:text-steel">See the maths &rarr;</dd>
          </Link>
          <div className="border-l border-line/50 px-5 py-5 sm:border-l-0">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Cards</dt>
            <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight">{cardCount}</dd>
          </div>
          <div className="border-l border-line/50 px-5 py-5">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Unique players</dt>
            <dd className="mt-1.5 text-2xl font-black tabular-nums tracking-tight">{clubValue?.unique_player_count ?? 0}</dd>
          </div>
        </dl>

        <p className="text-sm leading-relaxed text-ink-faint">
          {Number(clubValue?.owned_cards_value ?? 0).toLocaleString()} KUT Coins of owned-card discard value across{" "}
          {clubValue?.unique_player_count ?? 0} unique players, plus a {Number(clubValue?.personal_card_bonus ?? 0).toLocaleString()} personal-card
          bonus. <Link className="font-bold text-brass hover:underline" href="/club/value">See the full breakdown</Link>.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Link className="group rounded-2xl border border-line/60 bg-panel/70 p-7 hover:border-brass/60" href="/club/collection">
            <h2 className="display text-3xl group-hover:text-brass">Browse Collection &rarr;</h2>
            <p className="mt-3 text-sm text-ink-faint">Every Live Card and special edition you own, {cardCount} in total.</p>
          </Link>
          <Link className="group rounded-2xl border border-line/60 bg-panel/70 p-7 hover:border-brass/60" href="/club/packs">
            <h2 className="display text-3xl group-hover:text-brass">Open Packs &rarr;</h2>
            <p className="mt-3 text-sm text-ink-faint">Spend KUT Coins on new Live Cards.</p>
          </Link>
        </div>

        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm text-ink-faint">
          Squad building is planned for a future season &mdash; this tab will grow to include your matchday lineup.
        </p>
      </section>
    </main>
  );
}
