import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import { LEADERBOARD_TABS } from "@/lib/nav/routes";
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

// One table shape at every width: rank / member+club / value, with Cards and
// Players joining as their own columns from `sm` up. Those two take `hidden
// sm:block`, which drops them out of grid flow entirely below it, so three items
// land in three tracks. Mobile used to be a two-cell grid whose value line and
// cards/players line each took a full-width row of their own — three rows and
// ~129px per club, so only three fitted on a phone and the eye had to travel
// down rather than across to compare values (KB-005).
//
// The name track is the only flexible one, and its cell carries `min-w-0`. That
// is load-bearing: the pre-round-3 layout applied these fixed tracks at every
// width, so on a phone they overflowed and the name track collapsed to zero
// (finding #3). Any column added here stays fixed or `auto` — never a second 1fr.
const COLUMNS = "grid-cols-[2rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem_5rem_5rem]";

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
          <h1 className="display text-3xl sm:text-6xl">Leaderboard</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Club Value is your KUT Coins, plus the discard value of every unburned card you own, plus your linked
            player&rsquo;s Live-card value counted 4&times;.{" "}
            <Link className="font-bold text-brass hover:underline" href="/club/value">
              See the full breakdown
            </Link>
            .
          </p>
          {/* Clubs and Players are two rankings of the same season, so they are
              tabs of one section rather than two menu rows (ADR-053). */}
          <div className="pt-2">
            <SectionTabs label="Leaderboard" tabs={LEADERBOARD_TABS} />
          </div>
        </header>

        {clubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
            No active clubs are ready for the standings yet.
          </p>
        ) : (
          /* A ruled table rather than a boxed card: standings are a list of
             records and read faster as one. */
          <div>
            <div className={`grid gap-x-3 border-b border-line/60 px-3 pb-2.5 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint sm:gap-x-4 sm:pb-3 ${COLUMNS}`}>
              <span className="text-center">#</span>
              <span>Member &amp; club</span>
              <span className="text-right">Value</span>
              <span className="hidden text-right sm:block">Cards</span>
              <span className="hidden text-right sm:block">Players</span>
            </div>
            <ol>
              {clubs.map((club) => (
                <li
                  className={`grid items-center gap-x-3 border-b border-line/30 px-3 py-3 sm:gap-x-4 ${COLUMNS} ${
                    club.is_current_user ? "rounded-lg bg-brass/8" : ""
                  }`}
                  key={`${club.rank}-${club.display_name}`}
                >
                  <span
                    className={`text-center text-base font-black tabular-nums sm:text-xl ${club.rank <= 3 ? "text-brass" : "text-ink-faint"}`}
                  >
                    {club.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.95rem] font-extrabold leading-tight">
                      {club.display_name}
                      {club.is_current_user && (
                        <span className="ml-1.5 text-[0.6rem] font-black uppercase tracking-[0.12em] text-brass">You</span>
                      )}
                    </span>
                    {/* The counts are demoted onto this line below `sm`, not hidden:
                        BUILD_SPEC §39 lists card count and unique-player count as
                        leaderboard display fields, so both stay visible at every width. */}
                    <span className="mt-0.5 block truncate text-[0.7rem] tabular-nums text-ink-faint">
                      {club.club_name}
                      <span className="sm:hidden">
                        {" "}
                        &middot; {club.card_count} cards &middot; {club.unique_player_count} players
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-[0.95rem] font-black tabular-nums text-brass">
                    {Number(club.club_value).toLocaleString()}
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-ink-dim sm:block">{club.card_count}</span>
                  <span className="hidden text-right text-sm tabular-nums text-ink-dim sm:block">
                    {club.unique_player_count}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
