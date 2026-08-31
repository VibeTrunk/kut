import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type LeaderboardClub = {
  rank: number;
  display_name: string;
  club_name: string;
  club_value: number;
  card_count: number;
  unique_player_count: number;
  is_current_user: boolean;
};

const COLUMNS = "grid-cols-[3.5rem_minmax(0,1fr)_8rem_5rem_5rem] lg:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_9rem_5.5rem_5.5rem]";

export default async function LeaderboardPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("club_value_leaderboard")
    .select("rank, display_name, club_name, club_value, card_count, unique_player_count, is_current_user")
    .order("rank")
    .order("display_name");

  if (error) throw new Error("Could not load the club leaderboard.");
  const clubs = (data ?? []) as LeaderboardClub[];

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">KUT standings</p>
          <h1 className="display text-5xl sm:text-6xl">Club Value Leaderboard</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Club Value is your KUT Coins, plus the discard value of every unburned card you own, plus your linked
            player&rsquo;s Live-card value counted 4&times;.{" "}
            <Link className="font-bold text-brass hover:underline" href="/club/value">
              See the full breakdown
            </Link>
            .
          </p>
        </header>

        {clubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
            No active clubs are ready for the standings yet.
          </p>
        ) : (
          /* A ruled table rather than a boxed card: standings are a list of
             records and read faster as one. */
          <div>
            <div className={`hidden gap-4 border-b border-line/60 px-3 pb-3 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint sm:grid ${COLUMNS}`}>
              <span>Rank</span>
              <span>Member</span>
              <span className="hidden lg:block">Club</span>
              <span className="text-right">Value</span>
              <span className="text-right">Cards</span>
              <span className="text-right">Players</span>
            </div>
            <ol>
              {clubs.map((club) => (
                <li
                  className={`grid gap-x-4 gap-y-1 border-b border-line/30 px-3 py-4 sm:items-center ${COLUMNS} ${
                    club.is_current_user ? "rounded-lg bg-brass/8" : ""
                  }`}
                  key={`${club.rank}-${club.display_name}`}
                >
                  <span
                    className={`text-2xl font-black tabular-nums ${club.rank <= 3 ? "text-brass" : "text-ink-faint"}`}
                  >
                    {club.rank}
                  </span>
                  <span className="min-w-0 truncate font-extrabold">
                    {club.display_name}
                    {club.is_current_user && (
                      <span className="ml-2 text-[0.6rem] font-black uppercase tracking-[0.12em] text-brass">You</span>
                    )}
                  </span>
                  <span className="hidden min-w-0 truncate text-sm text-ink-faint lg:block">{club.club_name}</span>
                  <span className="font-black tabular-nums text-brass sm:text-right">
                    {Number(club.club_value).toLocaleString()}
                  </span>
                  <span className="text-sm tabular-nums text-ink-dim sm:text-right">{club.card_count}</span>
                  <span className="text-sm tabular-nums text-ink-dim sm:text-right">{club.unique_player_count}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
