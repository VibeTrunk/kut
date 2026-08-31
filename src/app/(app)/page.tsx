import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  ACTIVITY_FLOOR_ISO,
  ACTIVITY_KIND_LABEL,
  describeActivity,
  type ActivityRow,
} from "@/lib/activity";
import { formatDate } from "@/lib/format";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

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
    <main className="min-h-screen bg-board p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Terrible Football Haarlem</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">This week in KUT</h1>
          <p className="text-sm font-semibold text-ink-faint">Kelderklasse Ultimate Team</p>
          <p className="max-w-2xl text-lg leading-8 text-ink-dim">
            The five cards that rose most since the last published football week. Published attendance updates Live Ratings automatically.
          </p>
          <p className="text-sm">
            <Link className="font-semibold text-brass underline" href="/how-it-works">
              New here? How KUT works &rarr;
            </Link>
          </p>
        </header>

        <dl className="flex flex-wrap gap-3">
          <div className="min-w-28 rounded-2xl border border-line bg-panel/60 px-4 py-3">
            <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">KUT Coins</dt>
            <dd className="mt-1 text-2xl font-black text-brass">{balance.toLocaleString()}</dd>
          </div>
          <div className="min-w-28 rounded-2xl border border-line bg-panel/60 px-4 py-3">
            <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Club Value</dt>
            <dd className="mt-1 text-2xl font-black">{Number(clubValue).toLocaleString()}</dd>
          </div>
          {rank !== null && (
            <div className="min-w-28 rounded-2xl border border-steel-line/40 bg-steel-bg/30 px-4 py-3">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-steel">Rank</dt>
              <dd className="mt-1 text-2xl font-black text-steel">#{rank}</dd>
            </div>
          )}
          <Link
            className="flex min-w-28 items-center justify-center rounded-2xl border border-brass/50 bg-brass/10 px-4 py-3 text-sm font-black text-brass hover:bg-brass/20"
            href="/club/packs"
          >
            Open a pack →
          </Link>
        </dl>

        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-black tracking-tight">Top 5 risers this week</h2>
            <Link className="text-sm font-semibold text-brass underline" href="/players">
              See the full player directory &rarr;
            </Link>
          </div>

          {risers.length === 0 ? (
            <p className="rounded-2xl border border-line bg-panel p-5 text-ink-dim">
              Movers appear once a second football week has been published. Meanwhile, browse every card in the{" "}
              <Link className="font-semibold text-brass underline" href="/players">
                player directory
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-5">
              {risers.map((player) => (
                <Link
                  aria-label={`Open ${player.display_name}'s profile`}
                  className="rounded-[1.25rem] outline-offset-4 outline-brass focus-visible:outline-2"
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

        <section className="space-y-4">
          <h2 className="text-2xl font-black tracking-tight">Club activity</h2>
          {activity.length === 0 ? (
            <p className="rounded-2xl border border-line bg-panel p-5 text-ink-dim">
              Recent sales, listings, pack openings, and published sessions will show up here.
            </p>
          ) : (
            <ol className="space-y-3">
              {activity.map((row, index) => (
                <li
                  className="rounded-2xl border border-panel-2 bg-panel/50 p-4"
                  key={`${row.kind}-${row.ts}-${index}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-brass">
                      {ACTIVITY_KIND_LABEL[row.kind]}
                    </p>
                    <time className="text-xs font-semibold text-ink-faint" dateTime={row.ts}>
                      {formatDate(row.ts)}
                    </time>
                  </div>
                  <p className="mt-2 text-ink-dim">{describeActivity(row)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}
