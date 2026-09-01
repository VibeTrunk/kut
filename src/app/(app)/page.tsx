import Link from "next/link";
import { IconPack } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  ACTIVITY_FLOOR_ISO,
  activityKindLabel,
  describeActivity,
  type ActivityRow,
} from "@/lib/activity";
import { formatDate } from "@/lib/format";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type TopRiser = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  live_ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: string;
  photo_path: string | null;
  ovr_delta: number;
};

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const [
    { data: profile, error: profileError },
    risersResponse,
    walletResponse,
    clubValueResponse,
    rankResponse,
    activityResponse,
  ] = await Promise.all([
    supabase.schema("kut").from("profiles").select("is_disabled").eq("id", userId).maybeSingle(),
    supabase
      .schema("kut")
      .from("top_risers")
      .select("id, slug, display_name, archetype, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path, ovr_delta")
      .limit(5),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
    supabase.schema("kut").from("club_value_leaderboard").select("rank").eq("is_current_user", true).maybeSingle(),
    supabase
      .schema("kut")
      .from("activity_feed")
      .select("kind, ts, actor_name, counterparty_name, card_name, amount, session_date, session_type")
      .gte("ts", ACTIVITY_FLOOR_ISO)
      .order("ts", { ascending: false })
      .limit(12),
  ]);

  if (profileError) {
    throw new Error("Could not verify your KUT membership.");
  }
  if (!profile || profile.is_disabled) {
    redirect("/login");
  }
  if (risersResponse.error) {
    throw new Error("Could not load this week's movers.");
  }

  const risers = (risersResponse.data ?? []) as TopRiser[];
  const photoUrls = await resolvePhotoUrls(supabase, risers.map((player) => player.photo_path));
  const balance = walletResponse.data?.balance ?? 0;
  const clubValue = clubValueResponse.data?.club_value ?? balance;
  const rank = rankResponse.data?.rank ?? null;
  // The activity feed is a non-critical widget — never fail the Home page over it.
  const activity = (activityResponse.data ?? []) as ActivityRow[];

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-12 py-4 sm:py-8">
        <header className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-4">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Terrible Football Haarlem</p>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl">This week in KUT</h1>
            <p className="text-sm font-bold text-ink-faint">Kelderklasse Ultimate Team</p>
            <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
              The five cards that rose most since the last published football week. Published attendance updates Live Ratings automatically.
            </p>
            <p className="text-sm">
              <Link className="font-bold text-brass hover:underline" href="/how-it-works">
                New here? How KUT works &rarr;
              </Link>
            </p>
          </div>
          {/* Opening a pack is the primary action on this page, so it reads as a
              button rather than sitting inside the stats list as a fake figure. */}
          <Link
            className="inline-flex min-h-13 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-6 text-[0.95rem] font-black text-ink-on-accent shadow-lg shadow-brass/25 hover:brightness-105"
            href="/club/packs"
          >
            <IconPack className="h-5 w-5" />
            Open a pack
          </Link>
        </header>

        <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-panel-2/70 to-panel/70 sm:grid-cols-3">
          <div className="border-b border-line/50 px-6 py-5 sm:border-b-0 sm:border-l sm:first:border-l-0">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">KUT Coins</dt>
            <dd className="mt-1.5 text-3xl font-black tabular-nums tracking-tight text-brass">{balance.toLocaleString()}</dd>
            <dd className="mt-1 text-xs font-bold text-ink-faint">Wallet balance</dd>
          </div>
          <Link className="group border-b border-line/50 px-6 py-5 sm:border-b-0 sm:border-l sm:border-line/50" href="/club/value">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Club Value</dt>
            <dd className="mt-1.5 text-3xl font-black tabular-nums tracking-tight group-hover:text-brass">{Number(clubValue).toLocaleString()}</dd>
            <dd className="mt-1 text-xs font-bold text-ink-faint group-hover:text-brass">See the maths &rarr;</dd>
          </Link>
          <Link className="group px-6 py-5 sm:border-l sm:border-line/50" href="/leaderboard">
            <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Rank</dt>
            <dd className="mt-1.5 text-3xl font-black tabular-nums tracking-tight text-steel">{rank === null ? "—" : `#${rank}`}</dd>
            <dd className="mt-1 text-xs font-bold text-ink-faint group-hover:text-steel">Club Value leaderboard &rarr;</dd>
          </Link>
        </dl>

        <section className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-3xl">Top 5 risers this week</h2>
            <Link className="text-sm font-bold text-brass hover:underline" href="/players">
              See the full player directory &rarr;
            </Link>
          </div>

          {risers.length === 0 ? (
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-6 text-ink-dim">
              Movers appear once a second football week has been published. Meanwhile, browse every card in the{" "}
              <Link className="font-bold text-brass hover:underline" href="/players">
                player directory
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
              {risers.map((player) => (
                <Link
                  aria-label={`Open ${player.display_name}'s profile`}
                  className="rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                  href={`/players/${player.slug}`}
                  key={player.id}
                >
                  <LiveCard
                    player={{
                      id: player.id,
                      displayName: player.display_name,
                      archetype: player.archetype,
                      liveOvr: player.live_ovr,
                      pac: player.pac,
                      sho: player.sho,
                      pas: player.pas,
                      dri: player.dri,
                      def: player.def,
                      phy: player.phy,
                      rarityTier: player.rarity_tier as LiveCardPlayer["rarityTier"],
                      photoUrl: player.photo_path ? photoUrls.get(player.photo_path) ?? null : null,
                    }}
                    trend={player.ovr_delta}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="display text-3xl">Club activity</h2>
          {activity.length === 0 ? (
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-6 text-ink-dim">
              Recent sales, listings, pack openings, and published sessions will show up here.
            </p>
          ) : (
            /* A ruled ledger rather than a stack of rounded boxes: the feed is a
               list of records, and reads faster as one. */
            <ol>
              {activity.map((row, index) => (
                <li
                  className="grid gap-1.5 border-b border-line/30 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_7rem] sm:items-baseline sm:gap-6"
                  key={`${row.kind}-${row.ts}-${index}`}
                >
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-brass">
                    {activityKindLabel(row.kind)}
                  </p>
                  <p className="text-sm leading-relaxed text-ink-dim">
                    {row.kind === "session" ? (
                      <Link className="hover:text-brass hover:underline" href="/sessions">
                        {describeActivity(row)}
                      </Link>
                    ) : (
                      describeActivity(row)
                    )}
                  </p>
                  <time className="text-xs font-bold tabular-nums text-ink-faint sm:text-right" dateTime={row.ts}>
                    {formatDate(row.ts)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}
