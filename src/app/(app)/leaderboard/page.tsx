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
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">KUT standings</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Club Value Leaderboard</h1>
          <p className="mt-3 max-w-2xl text-ink-dim">Club Value is your KUT Coins, plus the discard value of every unburned card you own, plus your linked player&rsquo;s Live-card value counted 4&times;. <Link className="font-semibold text-brass underline" href="/club/value">See the full breakdown</Link>.</p>
        </header>

        {clubs.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">No active clubs are ready for the standings yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-panel/70">
            <div className="hidden grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_8rem_5rem_5rem] gap-3 border-b border-line px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-ink-faint sm:grid">
              <span>Rank</span><span>Member</span><span>Club</span><span className="text-right">Value</span><span className="text-right">Cards</span><span className="text-right">Players</span>
            </div>
            <ol>
              {clubs.map((club) => (
                <li className={`grid gap-x-3 gap-y-1 border-b border-panel-2 px-5 py-4 last:border-0 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_8rem_5rem_5rem] sm:items-center ${club.is_current_user ? "bg-brass/10" : ""}`} key={`${club.rank}-${club.display_name}`}>
                  <span className="row-span-2 text-2xl font-black text-brass sm:row-span-1">#{club.rank}</span>
                  <span className="font-black">{club.display_name}{club.is_current_user && <span className="ml-2 text-xs uppercase tracking-[0.12em] text-brass">You</span>}</span>
                  <span className="text-sm text-ink-faint">{club.club_name}</span>
                  <span className="font-black text-brass sm:text-right">{Number(club.club_value).toLocaleString()} KUT</span>
                  <span className="text-sm text-ink-dim sm:text-right">{club.card_count} cards</span>
                  <span className="text-sm text-ink-dim sm:text-right">{club.unique_player_count} players</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
