import Link from "next/link";
import type { ReactNode } from "react";
import { IconChronicle, IconPack } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  MidweekEntryCard,
  MidweekFinalCard,
  MidweekLiveCard,
  NOW_BRASS,
  NOW_CARD,
  NOW_KICKER,
} from "@/components/midweek/entry-points";
import {
  ACTIVITY_FLOOR_ISO,
  activityKindLabel,
  describeFoldedActivity,
  foldActivity,
  type ActivityRow,
} from "@/lib/activity";
import { checkInClosesAt, orderNowCards, type NowCard } from "@/lib/home/now";
import { formatShortLock, formatWeekday } from "@/lib/midweek/entry";
import { championLeadsUntil } from "@/lib/midweek/evening";
import { countNoun } from "@/game/reported-count";
import { formatDate } from "@/lib/format";
import { fetchInjuredPlayerIds, type InjuryStatus } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { loadMidweekEntryPoint } from "@/lib/midweek/load";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InjuryCheckInCard } from "./injury/check-in-card";

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
  rarity_tier: LiveCardPlayer["rarityTier"];
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

  // Midweek Madness has no scheduler: a Home visit locks, completes or opens a
  // week that is due, before this page reads it (ADR-098).
  await runDueMidweek();

  const [
    { data: profile, error: profileError },
    risersResponse,
    walletResponse,
    clubValueResponse,
    rankResponse,
    activityResponse,
    reportResponse,
    injuryResponse,
  ] = await Promise.all([
    supabase.schema("kut").from("profiles").select("is_disabled").eq("id", userId).maybeSingle(),
    supabase
      .schema("kut")
      .from("top_risers")
      .select(
        "id, slug, display_name, archetype, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path, ovr_delta",
      )
      .limit(5),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
    supabase
      .schema("kut")
      .from("club_value_leaderboard")
      .select("rank")
      .eq("is_current_user", true)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("activity_feed")
      .select(
        "kind, ts, actor_name, counterparty_name, card_name, amount, session_date, session_type, offered_card_names",
      )
      .gte("ts", ACTIVITY_FLOOR_ISO)
      .order("ts", { ascending: false })
      // Enough to fill six rows once a member's run of pack openings folds into one.
      .limit(30),
    supabase
      .schema("kut")
      .from("my_session_reports")
      .select("session_id, session_date, report_status, reward_received, closes_at")
      .eq("survey_status", "open")
      .order("closes_at")
      .limit(1)
      .maybeSingle(),
    supabase.schema("kut").rpc("my_injury_status"),
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
  if (reportResponse.error) {
    throw new Error("Could not load your open session report.");
  }

  const risers = (risersResponse.data ?? []) as TopRiser[];
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(
      supabase,
      risers.map((player) => player.photo_path),
    ),
    fetchInjuredPlayerIds(supabase),
  ]);
  // Midweek Madness: picking, the evening, or the champion until Thursday
  // (ADR-097, ADR-098). Tolerant: null whenever it is disabled, opted out or not
  // deployed, and then nothing shows.
  const now = new Date();
  const midweek = await loadMidweekEntryPoint(supabase, injuredPlayerIds, now, userId);
  // A failed read is not a zero balance (KB-014): both stats degrade to "we
  // don't know" rather than asserting a figure the member never had. The
  // `?? balance` on Club Value stays — a member with no cards has no
  // my_club_value row, and their club really is worth just their coins.
  if (walletResponse.error) console.error("home wallet read failed", walletResponse.error);
  if (clubValueResponse.error)
    console.error("home club value read failed", clubValueResponse.error);
  const balance = walletResponse.error ? null : (walletResponse.data?.balance ?? 0);
  const clubValue = clubValueResponse.error
    ? null
    : (clubValueResponse.data?.club_value ?? balance);
  const rank = rankResponse.data?.rank ?? null;
  // The activity feed is a non-critical widget — never fail the Home page over it.
  // Six rows, with a member's consecutive pack openings folded into one (ADR-114).
  const activity = foldActivity((activityResponse.data ?? []) as ActivityRow[], 6);
  const openReport = reportResponse.data;
  // Injury mode (ADR-082) is non-critical here too: a failed read hides the
  // check-in card rather than failing Home.
  if (injuryResponse.error) console.error("home injury status read failed", injuryResponse.error);
  const injury = (injuryResponse.error ? null : injuryResponse.data) as InjuryStatus | null;

  // The "now" stack (HANDOFF "Home", ADR-114): the cards with a deadline, the
  // Midweek evening first while it runs, then the soonest deadline first.
  const nowCards: NowCard<ReactNode>[] = [];
  if (midweek?.kind === "live") {
    nowCards.push({
      key: "midweek",
      leads: true,
      deadline: null,
      value: (
        <MidweekLiveCard
          button={midweek.button}
          kicker={midweek.kicker}
          line={midweek.line}
          match={midweek.match}
          title={midweek.title}
        />
      ),
    });
  }
  if (midweek?.kind === "pick") {
    nowCards.push({
      key: "midweek",
      deadline: Date.parse(midweek.lockAt),
      value: (
        <MidweekEntryCard lockAt={midweek.lockAt} now={now.toISOString()} saved={midweek.saved} />
      ),
    });
  }
  if (midweek?.kind === "final") {
    nowCards.push({
      key: "midweek",
      deadline: championLeadsUntil(midweek.lockAt).getTime(),
      value: (
        <MidweekFinalCard
          line={midweek.line}
          lockAt={midweek.lockAt}
          title={midweek.title}
          weekStart={midweek.weekStart}
        />
      ),
    });
  }
  if (openReport) {
    nowCards.push({
      key: "report",
      deadline: openReport.closes_at ? Date.parse(openReport.closes_at) : null,
      value: (
        <Link
          className={`group ${NOW_CARD} ${NOW_BRASS}`}
          href={`/sessions/${openReport.session_id}/report`}
        >
          <span className={NOW_KICKER}>Your report &middot; +50 KUT Coins</span>
          <span className="flex items-center justify-between gap-2.5">
            <span className="display text-2xl sm:text-3xl">
              {openReport.report_status === "submitted"
                ? "View your report"
                : `Add ${countNoun(openReport.session_date)} & kudos`}
            </span>
            <span aria-hidden="true" className="text-xl text-brass">
              &rarr;
            </span>
          </span>
          <span className="text-sm text-ink-faint">
            For {formatWeekday(openReport.session_date)}&rsquo;s session.
            {openReport.closes_at && ` Closes ${formatShortLock(openReport.closes_at)}.`}
          </span>
        </Link>
      ),
    });
  }
  if (injury?.injured && injury.checkable_week_start) {
    nowCards.push({
      key: "check-in",
      deadline: checkInClosesAt(injury.checkable_week_start),
      value: (
        <InjuryCheckInCard
          stipend={injury.stipend}
          weekLabel={formatDate(injury.checkable_week_start)}
          weekStart={injury.checkable_week_start}
        />
      ),
    });
  }

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:space-y-12 sm:py-8">
        {/* One short header (UX review): the masthead's paragraph became the
            risers' subtitle, and its two links sit with Club activity. */}
        <header className="grid gap-1.5">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
            Terrible Football Haarlem
          </p>
          <h1 className="display text-[30px] sm:text-5xl lg:text-6xl">This week in KUT</h1>
        </header>

        {nowCards.length > 0 && (
          <section aria-label="Now" className="grid gap-3">
            {orderNowCards(nowCards).map((card) => (
              <div className="grid" key={card.key}>
                {card.value}
              </div>
            ))}
          </section>
        )}

        {injury?.injured && !injury.checkable_week_start && (
          <p className="rounded-2xl border border-line/60 bg-panel/60 p-5 text-sm text-ink-dim">
            <span className="font-bold text-ink">Injury mode.</span>{" "}
            {injury.checked_in_this_week
              ? "Your card is protected this week. ✓"
              : "Your next rehab check-in opens once this week's session is published."}{" "}
            {injury.protected_weeks > 0 &&
              `${injury.protected_weeks} ${injury.protected_weeks === 1 ? "week" : "weeks"} protected so far.`}
          </p>
        )}

        {/* The KUT Coins tile went: the coin pill in the bar shows the balance
            (UX review). Club Value and Rank read as links, and opening a pack
            is the page's own action, full width on a phone. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Link
            className="grid gap-0.5 rounded-[14px] border border-line/60 bg-panel/50 px-3.5 py-3 hover:border-brass/60 sm:px-5 sm:py-4"
            href="/club/value"
          >
            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">
              Club Value
            </span>
            <span className="text-[22px] font-black tabular-nums tracking-tight sm:text-3xl">
              {clubValue === null ? "—" : Number(clubValue).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-brass">See the maths &rarr;</span>
          </Link>
          <Link
            className="grid gap-0.5 rounded-[14px] border border-line/60 bg-panel/50 px-3.5 py-3 hover:border-brass/60 sm:px-5 sm:py-4"
            href="/leaderboard"
          >
            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">
              Rank
            </span>
            <span className="text-[22px] font-black tabular-nums tracking-tight text-steel sm:text-3xl">
              {rank === null ? "—" : `#${rank}`}
            </span>
            <span className="text-xs font-bold text-brass">Standings &rarr;</span>
          </Link>
          <Link
            className="col-span-2 inline-flex min-h-13 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-6 text-[0.95rem] font-black text-ink-on-accent shadow-lg shadow-brass/25 hover:brightness-105 sm:col-span-1"
            href="/club/packs"
          >
            <IconPack className="h-5 w-5" />
            Open a pack
          </Link>
        </div>

        <section className="space-y-6">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display text-3xl">Top risers</h2>
              <Link className="text-sm font-bold text-brass hover:underline" href="/players">
                Players &rarr;
              </Link>
            </div>
            <p className="text-sm text-ink-dim">
              The five cards that rose most since the last published football week. Published
              attendance updates Live Ratings automatically.
            </p>
          </div>

          {risers.length === 0 ? (
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-6 text-ink-dim">
              Movers appear once a second football week has been published. Meanwhile, browse every
              card in the{" "}
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
                    player={toLiveCardPlayer(player, injuredPlayerIds, photoUrls)}
                    trend={player.ovr_delta}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-3xl">Club activity</h2>
            {/* The Chronicle lost its More-menu slot when that menu went (ADR-053);
                Home is its way in, beside the activity it reports on. */}
            <Link
              className="inline-flex items-center gap-2 text-sm font-bold text-brass hover:underline"
              href="/chronicle"
            >
              <IconChronicle aria-hidden="true" className="h-4 w-4" />
              This week&rsquo;s Chronicle &rarr;
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-6 text-ink-dim">
              Recent sales, listings, pack openings, and published sessions will show up here.
            </p>
          ) : (
            /* A ruled ledger rather than a stack of rounded boxes: the feed is a
               list of records, and reads faster as one. */
            <ol>
              {activity.map((row, index) => (
                /* Below `sm` this used to stack into three rows per entry — kind,
                   description, timestamp — twelve times, making the longest block
                   on the most-visited page. Two rows now: kind and time share a
                   line, the description sits under them. Nothing is hidden. */
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 border-b border-line/30 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_7rem] sm:gap-6"
                  key={`${row.kind}-${row.ts}-${index}`}
                >
                  <p className="order-1 text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-brass sm:order-none">
                    {row.packs > 1 ? "Packs opened" : activityKindLabel(row.kind)}
                  </p>
                  <p className="order-3 col-span-2 text-sm leading-relaxed text-ink-dim sm:order-none sm:col-span-1">
                    {row.kind === "session" ? (
                      <Link className="hover:text-brass hover:underline" href="/chronicle">
                        {describeFoldedActivity(row)}
                      </Link>
                    ) : (
                      describeFoldedActivity(row)
                    )}
                  </p>
                  <time
                    className="order-2 text-xs font-bold tabular-nums text-ink-faint sm:order-none sm:text-right"
                    dateTime={row.ts}
                  >
                    {formatDate(row.ts)}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <p className="text-sm">
            <Link className="font-bold text-brass hover:underline" href="/how-it-works">
              New here? How KUT works &rarr;
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
