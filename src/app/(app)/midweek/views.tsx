import Link from "next/link";
import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MidweekNotice, MidweekSaveStatus, MidweekTrialistCard } from "@/components/midweek/bits";
import { MidweekClock } from "@/components/midweek/clock";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MidweekCountdown } from "@/components/midweek/countdown";
import { MidweekFiveList } from "@/components/midweek/five-list";
import { MidweekMatchRow } from "@/components/midweek/match-row";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { MIDWEEK_PAGE, MidweekPageHead, MidweekSectionHead } from "@/components/midweek/page-head";
import { MidweekPath } from "@/components/midweek/path";
import { MidweekWeeklyCalls } from "@/components/midweek/calls-list";
import { MidweekPlaceholder } from "@/components/midweek/placeholder";
import { MidweekPredictions } from "@/components/midweek/predictions";
import { MidweekRatingList } from "@/components/midweek/rating-list";
import {
  MidweekLaneTimeline,
  MidweekScoreboard,
  MidweekShootoutLive,
} from "@/components/midweek/report";
import { MidweekSeed } from "@/components/midweek/seed";
import { MIDWEEK } from "@/game/midweek/config";
import { predictionCoins } from "@/game/midweek/rewards";
import { seedHash } from "@/game/midweek/rng";
import { roundStartAt } from "@/game/midweek/schedule";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { callCards, weeklyCallsLine } from "@/lib/midweek/calls";
import { toLiveCardPlayer, type OwnedCardRow } from "@/lib/live-card-player";
import {
  allStillOwned,
  formatClock,
  formatDayDate,
  formatDayMonth,
  joinNames,
  lastWeekSummary,
  roundIntervalText,
  scheduleVersionOf,
  skipOrVoidNotice,
  type MidweekCurrent,
  type MidweekTournament,
  type MySquadRow,
} from "@/lib/midweek/entry";
import {
  assembleBracket,
  entryCardFace,
  eveningPhase,
  eveningStops,
  fieldCounts,
  finalLine,
  finishStat,
  firstMatch,
  fiveOf,
  myNight,
  nightTotals,
  roundName,
  roundsYouAreIn,
  settledWinner,
  sideScore,
  type BracketRound,
} from "@/lib/midweek/evening";
import { loadLiveMatch, type LiveMatch } from "@/lib/midweek/live-load";
import { loadCalls, loadMyRewards, loadNightRatings, loadWeekResults } from "@/lib/midweek/results";
import type { MatchRow } from "@/lib/midweek/rows";
import { resolvePhotoUrls } from "@/lib/player-photos";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PANEL = "rounded-2xl border border-line/60 bg-panel/60 p-5 sm:p-6";
/** Two columns on a phone (the last odd card centred), five from `sm`. */
const FIVE =
  "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5 sm:gap-5 max-sm:[&>:last-child:nth-child(odd)]:col-span-2 max-sm:[&>:last-child:nth-child(odd)]:w-[calc(50%-6px)] max-sm:[&>:last-child:nth-child(odd)]:justify-self-center";

function FiveCards({ cards, label }: { cards: (LiveCardPlayer | null)[]; label: string }) {
  return (
    <ul aria-label={label} className={FIVE}>
      {cards.map((card, index) => (
        <li key={index}>
          {card ? (
            <LiveCard player={card} />
          ) : (
            <MidweekTrialistCard
              slot={index + 1}
              state="trialist"
              trialistOvr={MIDWEEK.trialist.ovr}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

// ---- last week, above the picker -------------------------------------------------

export type LastWeekView =
  | { kind: "notice"; tone: "info" | "warn"; lead: string; rest: string }
  | { kind: "strip"; kicker: string; text: string; href: string };

/**
 * The previous tournament's outcome above the picker (Picker-Saved and the
 * Week-Skipped and Week-Void notices): how far the member got, their coins and
 * the champion, with the bracket one tap away; or why nothing was played.
 */
export async function lastWeekView(
  supabase: SupabaseServerClient,
  userId: string,
  tournament: MidweekTournament,
  consecutive: boolean,
): Promise<LastWeekView | null> {
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) return { kind: "notice", ...notice };
  if (tournament.status !== "complete" || !tournament.rounds) return null;

  const [rewardsResponse, entryResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_midweek_rewards")
      .select("*")
      .eq("tournament_id", tournament.tournament_id),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("user_id")
      .eq("tournament_id", tournament.tournament_id)
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (rewardsResponse.error || entryResponse.error) return null;
  return {
    kind: "strip",
    kicker: consecutive
      ? `Last Wednesday · ${formatDayMonth(tournament.lock_at)}`
      : `Midweek Madness · ${formatDayDate(tournament.lock_at)}`,
    text: lastWeekSummary({
      rounds: tournament.rounds,
      rewards: rewardsResponse.data ?? [],
      entered: (entryResponse.data ?? []).length > 0,
      isChampion: tournament.champion_user_id === userId,
      championName: tournament.champion_name ?? null,
    }),
    href: `/midweek/${tournament.week_start}`,
  };
}

export function LastWeek({ view }: { view: LastWeekView }) {
  if (view.kind === "notice") {
    return (
      <MidweekNotice live tone={view.tone}>
        <b>{view.lead}</b> {view.rest}
      </MidweekNotice>
    );
  }
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[14px] border border-line/60 bg-board-deep/55 px-3.5 py-3">
      <p className="col-span-2 text-[0.65rem] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
        {view.kicker}
      </p>
      <p className="text-[13.5px] leading-snug text-ink-dim">{view.text}</p>
      <Link
        className="inline-flex min-h-11 items-center text-sm font-bold whitespace-nowrap text-brass hover:underline"
        href={view.href}
      >
        Bracket &rarr;
      </Link>
    </section>
  );
}

// ---- Wednesday evening ---------------------------------------------------------

/** One round's pairings: a kick-off time on the right before it starts, the bracket link once played. */
function RoundSection({
  round,
  weekStart,
  userId,
  link,
  title = round.name,
}: {
  round: BracketRound;
  weekStart: string;
  userId: string;
  link: boolean;
  /** "This round" while it is in play (Evening-YourMatch). */
  title?: string;
}) {
  const id = `evening-round-${round.round}-h`;
  return (
    <section aria-labelledby={id} className="grid gap-3.5">
      <MidweekSectionHead id={id} title={title}>
        {link ? (
          <Link
            className="text-sm font-bold text-brass hover:underline"
            href={`/midweek/${weekStart}`}
          >
            Full bracket &rarr;
          </Link>
        ) : (
          <p className="text-[13px] text-ink-faint tabular-nums">
            Kick-off {formatClock(round.kickoffAt)}
          </p>
        )}
      </MidweekSectionHead>
      <div className="grid gap-2 sm:grid-cols-2">
        {round.pairs.map((pair) => (
          <MidweekMatchRow key={pair.pairing} pair={pair} weekStart={weekStart} you={userId} />
        ))}
      </div>
    </section>
  );
}

/**
 * The evening from the lock (MM 2.0 F5, ADR-113; live states F6, ADR-115),
 * under the sticky `MidweekClock`:
 *
 * - `draw` (Evening-Draw), lock to round 1: your first match with your five and
 *   your opponent's, or both possible opponents' after a bye, then round 1's
 *   pairings with their kick-off;
 * - `round` while you're in, and `out` (Evening-Out) once you've lost: your
 *   match live while it plays (Evening-YourMatch), your night, then the round
 *   in play ("This round", every other match in play with no score), or between
 *   rounds the next round's kick-offs and the round just played;
 * - `final`, for everyone: the final live, chance by chance and kick by kick
 *   (Evening-FinalLive), and that coins and the champion follow its end.
 *
 * While a match is in play the page asks for itself again every 20 seconds,
 * and otherwise once at the next kick-off (`MidweekLivePoller`).
 */
export async function WeekEvening({
  supabase,
  current,
  now,
  userId,
  squad,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  now: Date;
  userId: string;
  squad: MySquadRow[] | null;
}) {
  const lockAt = current.lock_at as string;
  const weekStart = current.week_start as string;
  const rounds = current.status === "simulated" ? current.rounds : null;
  if (!rounds) {
    return <WeekLocked current={current} now={now} squad={squad} supabase={supabase} />;
  }

  const results = await loadWeekResults(supabase, current.tournament_id as string, now);
  const scheduleVersion = scheduleVersionOf(current);
  const nowIso = now.toISOString();
  const night = myNight({ userId, rounds, lockAt, scheduleVersion, matches: results.matches });
  const entered =
    night.entered ||
    results.draw.some((row) => row.side_0_user_id === userId || row.side_1_user_id === userId);
  const phase = eveningPhase({ rounds, lockAt, scheduleVersion, now, night });
  const stops = eveningStops({
    lockAt,
    scheduleVersion,
    rounds,
    now,
    matches: results.matches,
    youThrough: roundsYouAreIn(night, entered, rounds),
  });
  const autoUserIds = new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id));
  const bracket = assembleBracket({
    rounds,
    lockAt,
    scheduleVersion,
    draw: results.draw,
    matches: results.matches,
    autoUserIds,
  });
  const roundOne = formatClock(bracket[0].kickoffAt);
  const finalAt = formatClock(bracket[rounds - 1].kickoffAt);
  const thisRound = phase.round > 0 ? bracket[phase.round - 1] : null;
  const inPlay = thisRound?.pairs.some((pair) => pair.kind === "inplay") ?? false;
  const nextKickoff =
    bracket.find((round) => Date.parse(round.kickoffAt) > now.getTime())?.kickoffAt ?? null;

  // The one match this member watches live: theirs this round, or the final.
  const watched = thisRound?.pairs.find(
    (pair) =>
      pair.kind === "inplay" &&
      (phase.kind === "final" || pair.sides.some((side) => side.userId === userId)),
  );
  // Calls, once the member is out (ADR-118): every later match they are not in.
  const out = night.rows.some((row) => row.kind === "out");
  const calls = out ? await loadCalls(supabase, current.tournament_id as string) : null;
  const cards = calls
    ? callCards({ bracket, night, predictions: calls.predictions, splits: calls.splits, now })
    : null;
  const callBlock = (foot: boolean) =>
    cards && (
      <MidweekPredictions
        cards={cards}
        coins={predictionCoins(rounds)}
        foot={foot}
        rounds={rounds}
        tournamentId={current.tournament_id as string}
      />
    );
  const callsPending = cards?.some((card) => card.pick !== null && card.state !== "ended") ?? false;

  const live =
    watched?.kind === "inplay"
      ? await loadLiveMatch(supabase, {
          tournament: {
            tournament_id: current.tournament_id as string,
            seed_hash: current.seed_hash,
            rounds,
          },
          scheduleVersion,
          match: watched.match,
          now,
        })
      : null;

  const yourNight = night.entered && (
    <section aria-labelledby="night-h" className="grid content-start gap-4">
      <MidweekSectionHead id="night-h" title="Your night">
        <p className="text-[13px] text-ink-faint">
          +{night.coins}
          {night.alive ? " so far" : ""} &middot; paid after the final
        </p>
      </MidweekSectionHead>
      <MidweekPath now={nowIso} rounds={rounds} rows={night.rows} weekStart={weekStart} />
    </section>
  );

  // The round in play, or between rounds the next one's kick-offs and the round just played.
  const roundSections =
    thisRound && inPlay ? (
      <RoundSection
        link
        round={thisRound}
        title="This round"
        userId={userId}
        weekStart={weekStart}
      />
    ) : (
      <>
        {bracket[phase.round] && (
          <RoundSection
            link={false}
            round={bracket[phase.round]}
            userId={userId}
            weekStart={weekStart}
          />
        )}
        {thisRound && <RoundSection link round={thisRound} userId={userId} weekStart={weekStart} />}
      </>
    );

  let body;
  if (phase.kind === "draw") {
    const first = firstMatch({ userId, draw: results.draw, rounds, lockAt, scheduleVersion });
    const mine = fiveOf(results.entries, userId);
    const theirs = (first?.opponentIds ?? []).flatMap((id) => {
      const five = fiveOf(results.entries, id);
      return five ? [five] : [];
    });
    body = (
      <>
        {first && mine ? (
          <section aria-labelledby="first-h" className="grid gap-3.5">
            <MidweekSectionHead id="first-h" title="Your first match">
              <p className="text-[13px] text-ink-faint tabular-nums">
                {roundName(first.round, rounds)} &middot; kick-off {formatClock(first.kickoffAt)}
              </p>
            </MidweekSectionHead>
            <p className="text-ink-dim">{first.text}</p>
            <div className="grid items-start gap-3.5 sm:grid-cols-2">
              <MidweekFiveList five={mine} you />
              <div className="grid content-start gap-3.5">
                {theirs.map((five) => (
                  <MidweekFiveList five={five} key={five.userId} you={false} />
                ))}
              </div>
            </div>
          </section>
        ) : current.opted_out ? (
          <p className={`${PANEL} text-sm text-ink-dim`}>
            You opted out, so you aren&rsquo;t in tonight.
          </p>
        ) : null}
        <p className="text-[13px] text-ink-faint">
          Form, pick boost and the chances before kick-off appear when round 1 starts at {roundOne}.
        </p>
        <RoundSection link round={bracket[0]} userId={userId} weekStart={weekStart} />
      </>
    );
  } else if (phase.kind === "final") {
    const pair = bracket[rounds - 1].pairs[0];
    body = (
      <>
        {pair.kind === "inplay" ? (
          <LiveMatchBlock
            autoUserIds={autoUserIds}
            id="final-h"
            live={live}
            match={pair.match}
            title="The final"
            userId={userId}
            weekStart={weekStart}
          />
        ) : (
          <section aria-labelledby="final-h" className="grid gap-3.5">
            <MidweekSectionHead id="final-h" title="The final">
              {pair.kind === "played" && (
                <Link
                  className="text-sm font-bold text-brass hover:underline"
                  href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
                >
                  Report &rarr;
                </Link>
              )}
            </MidweekSectionHead>
            {pair.kind === "played" ? (
              <FinalScoreboard autoUserIds={autoUserIds} match={pair.match} userId={userId} />
            ) : (
              <MidweekMatchRow pair={pair} weekStart={weekStart} you={userId} />
            )}
          </section>
        )}
        {callBlock(false)}
        <p className={`${PANEL} text-sm text-ink-dim`}>
          The champion is named and coins are paid when the final ends.
          {night.entered
            ? callsPending
              ? ` You: +${night.coins} so far, and ${predictionCoins(rounds)} for each call that comes true.`
              : ` You: +${night.coins} so far.`
            : ""}
        </p>
        {rounds > 1 && (
          <RoundSection link round={bracket[rounds - 2]} userId={userId} weekStart={weekStart} />
        )}
      </>
    );
  } else {
    body = (
      <>
        {watched?.kind === "inplay" && (
          <LiveMatchBlock
            autoUserIds={autoUserIds}
            id="yours-h"
            live={live}
            match={watched.match}
            title="Your match"
            userId={userId}
            weekStart={weekStart}
          />
        )}
        {phase.kind === "out" ? (
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
            {yourNight}
            <div className="grid content-start gap-3.5">
              {callBlock(true)}
              <section
                aria-labelledby="final-card-h"
                className="grid gap-2 rounded-2xl border border-brass/50 bg-brass-bg/30 p-4 sm:px-6 sm:py-5"
              >
                <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
                  The final &middot; {finalAt}
                </p>
                <h2 className="display text-2xl sm:text-3xl" id="final-card-h">
                  Everyone watches it live
                </h2>
                <p className="text-sm text-ink-dim">Chance by chance, on this page.</p>
              </section>
            </div>
          </div>
        ) : (
          yourNight
        )}
        {roundSections}
      </>
    );
  }

  return (
    <main className={MIDWEEK_PAGE}>
      <MidweekClock
        stops={stops}
        updated={<MidweekLivePoller at={nowIso} nextAt={nextKickoff} poll={inPlay} />}
      />
      <section className="mx-auto grid max-w-6xl gap-8 pb-4 sm:gap-11 sm:pb-8">
        <CompeteTabs />
        <MidweekPageHead
          kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
          title={phase.title}
        />
        {body}
      </section>
    </main>
  );
}

/**
 * A match this member watches live (Evening-YourMatch, Evening-FinalLive): the
 * scoreboard in team colours, a single-match block (DR2-1), as it stands now;
 * then the shoot-out's kicks once it has begun, or else the latest chance.
 */
function LiveMatchBlock({
  title,
  id,
  match,
  live,
  userId,
  autoUserIds,
  weekStart,
}: {
  title: string;
  id: string;
  match: MatchRow;
  live: LiveMatch | null;
  userId: string;
  autoUserIds: ReadonlySet<string>;
  weekStart: string;
}) {
  const managers = [match.side_0_name, match.side_1_name ?? ""] as const;
  const side1 = match.side_1_user_id ?? "";
  return (
    <section aria-labelledby={id} className="grid gap-3.5">
      <MidweekSectionHead id={id} title={title}>
        <Link
          className="text-sm font-bold text-brass hover:underline"
          href={`/midweek/${weekStart}/match/${match.match_id}`}
        >
          Watch it &rarr;
        </Link>
      </MidweekSectionHead>
      <MidweekScoreboard
        auto={[autoUserIds.has(match.side_0_user_id), autoUserIds.has(side1)]}
        goals={live?.live.score ?? [0, 0]}
        live={{ minute: live?.live.minute ?? 0, penalties: live?.live.penalties ?? null }}
        managers={managers}
        penalties={null}
        winnerSide={null}
        youSide={match.side_0_user_id === userId ? 0 : side1 === userId ? 1 : null}
      />
      {live?.live.shootout && live.live.penalties ? (
        <MidweekShootoutLive
          kicks={live.live.kicks}
          managers={managers}
          penalties={live.live.penalties}
        />
      ) : live && live.live.timeline.length > 0 ? (
        <MidweekLaneTimeline live managers={managers} timeline={live.live.timeline.slice(-1)} />
      ) : null}
    </section>
  );
}

/** The final at full time, in team colours: a single-match block (DR2-1). */
function FinalScoreboard({
  match,
  userId,
  autoUserIds,
}: {
  match: MatchRow;
  userId: string;
  autoUserIds: ReadonlySet<string>;
}) {
  const a = sideScore(match, 0);
  const b = sideScore(match, 1);
  const side1 = match.side_1_user_id ?? "";
  return (
    <MidweekScoreboard
      auto={[autoUserIds.has(match.side_0_user_id), autoUserIds.has(side1)]}
      goals={[a.goals, b.goals]}
      managers={[match.side_0_name, match.side_1_name ?? ""]}
      penalties={a.penalties !== null && b.penalties !== null ? [a.penalties, b.penalties] : null}
      winnerSide={settledWinner(match)}
      youSide={match.side_0_user_id === userId ? 0 : side1 === userId ? 1 : null}
    />
  );
}

/**
 * The lock has passed but the worker hasn't drawn the week yet: a moment at
 * most, since every Midweek page runs it first (ADR-098). Only the member's
 * own five.
 */
async function WeekLocked({
  supabase,
  current,
  now,
  squad,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  now: Date;
  squad: MySquadRow[] | null;
}) {
  const lockAt = current.lock_at as string;
  const lock = new Date(lockAt);
  const scheduleVersion = scheduleVersionOf(current);
  const roundOneAt = roundStartAt(lock, 1, scheduleVersion).toISOString();
  const roundOne = formatClock(roundOneAt);
  let five: { cards: (LiveCardPlayer | null)[]; lost: string[] } | null = null;
  if (!current.opted_out && squad && squad.length > 0) {
    const [collection, injuredPlayerIds] = await Promise.all([
      supabase
        .schema("kut")
        .from("my_collection_cards")
        .select(
          "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
        )
        .in(
          "card_id",
          squad.map((row) => row.card_id),
        ),
      fetchInjuredPlayerIds(supabase),
    ]);
    if (collection.error) throw new Error("Could not load your five.");
    const rows = (collection.data ?? []) as (OwnedCardRow & { card_id: string; ovr: number })[];
    const byCard = new Map(rows.map((row) => [row.card_id, row]));
    const photoUrls = await resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    );
    const missing = squad.filter((row) => !byCard.has(row.card_id)).map((row) => row.player_id);
    const names = new Map<string, string>();
    if (missing.length > 0) {
      const { data } = await supabase
        .schema("kut")
        .from("player_directory")
        .select("id, display_name")
        .in("id", missing);
      for (const row of (data ?? []) as { id: string; display_name: string }[]) {
        names.set(row.id, row.display_name);
      }
    }
    // As the engine plays it: the surviving picks moved up, trialists after them (ADR-095).
    const kept = squad.flatMap((row) => {
      const card = byCard.get(row.card_id);
      return card ? [toLiveCardPlayer(card, injuredPlayerIds, photoUrls)] : [];
    });
    five = {
      cards: [...kept, ...Array.from({ length: MIDWEEK.squadSize - kept.length }, () => null)],
      lost: missing.map((id) => names.get(id) ?? "A Player"),
    };
  }

  const lede = `The draw comes out in a moment. Round 1 kicks off at ${roundOne}, then a round ${roundIntervalText(scheduleVersion)}.`;
  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <CompeteTabs />
        <MidweekPageHead
          kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
          lede={lede}
          title="Squads are locked"
        />
        <p className={`${PANEL} text-center text-[13px] text-ink-dim`}>
          <b className="text-ink">Round 1 at {roundOne}</b>,{" "}
          <MidweekCountdown now={now.toISOString()} target={roundOneAt} />.
        </p>
        {current.opted_out ? (
          <p className={`${PANEL} text-sm text-ink-dim`}>
            You opted out, so you aren&rsquo;t in tonight.
          </p>
        ) : five ? (
          <section aria-labelledby="five-h" className="grid gap-4">
            <MidweekSectionHead id="five-h" title="Your five">
              <MidweekSaveStatus
                kind={five.lost.length > 0 ? "dirty" : "saved"}
                text={
                  five.lost.length > 0
                    ? `${joinNames(five.lost)} ${five.lost.length === 1 ? "was" : "were"} no longer in your collection at the lock, so a trialist took ${five.lost.length === 1 ? "that slot" : "those slots"}.`
                    : allStillOwned(squad?.length ?? 0)
                }
              />
            </MidweekSectionHead>
            <FiveCards cards={five.cards} label="Your five" />
            <p className="flex items-start gap-2.5 text-[13px] leading-normal text-ink-dim">
              Members see every five once the draw is out. Your cards are never at stake: a result
              only ever pays coins.
            </p>
          </section>
        ) : squad !== null ? (
          <p className={`${PANEL} text-sm text-ink-dim`}>
            You didn&rsquo;t pick, so an auto squad plays for you. See it once the draw is out.
          </p>
        ) : null}
        <MidweekSeed seedHash={current.seed_hash as string} />
      </section>
    </main>
  );
}

// ---- Wednesday night and Thursday: the champion (owner decision D4) --------------

/**
 * Week-Complete: the champion leads, then the member's own result and coins
 * (now paid), the night in numbers, their five's ratings (DR3, ADR-117), the
 * next week one tap away, and the seed with its check against the seal (§44.8).
 */
export async function WeekComplete({
  supabase,
  tournament,
  next,
  userId,
  now,
}: {
  supabase: SupabaseServerClient;
  tournament: MidweekTournament;
  /** Next week's open tournament, when it exists. */
  next: MidweekCurrent | null;
  userId: string;
  now: Date;
}) {
  const rounds = tournament.rounds as number;
  const [results, rewards, calls] = await Promise.all([
    loadWeekResults(supabase, tournament.tournament_id),
    loadMyRewards(supabase, tournament.tournament_id),
    loadCalls(supabase, tournament.tournament_id),
  ]);
  const championId = tournament.champion_user_id ?? null;
  const championCards = results.entries
    .filter((row) => row.user_id === championId)
    .sort((a, b) => a.slot - b.slot);
  const photoUrls = await resolvePhotoUrls(
    supabase,
    championCards.map((row) => row.photo_path),
  );
  const final = results.matches.find((match) => match.round === rounds && !match.bye);
  const night = myNight({
    userId,
    rounds,
    lockAt: tournament.lock_at,
    scheduleVersion: scheduleVersionOf(tournament),
    matches: results.matches,
  });
  const finish = finishStat(night, rounds);
  const coins = rewards.reduce((sum, row) => sum + Number(row.amount), 0);
  // Calls (ADR-118): counted from the member's own picks, since a member with
  // none right has no reward row; the coins from the row once paid.
  const picks = calls.predictions.length;
  const right = calls.predictions.filter((row) => row.correct === true).length;
  const perCall = predictionCoins(rounds);
  const callCoins = calls.reward ? Number(calls.reward.amount) : right * perCall;
  const field = fieldCounts(results.entries);
  const totals = nightTotals(results.matches, rounds);
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";
  const championName = tournament.champion_name ?? "The champion";
  const ratings = await loadNightRatings(supabase, tournament, results, userId);

  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <CompeteTabs />
        <section
          aria-labelledby="champion-h"
          className="relative grid gap-3.5 overflow-hidden rounded-[20px] border border-brass-line bg-[radial-gradient(90%_120%_at_100%_0%,rgb(224_172_74/22%),transparent_60%),linear-gradient(to_bottom,#2b2112,#1a150e)] px-5 py-[22px] sm:px-9 sm:py-8"
        >
          <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            Midweek Madness &middot; {formatDayDate(tournament.lock_at)} &middot; Champion
          </p>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="h-[34px] w-7 flex-none bg-brass [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]"
            />
            <h1
              className="display text-[54px] leading-none [overflow-wrap:anywhere] sm:text-8xl"
              id="champion-h"
            >
              {championName}
            </h1>
          </div>
          <p className="text-[15px] leading-normal text-ink-dim">
            {final && <b className="text-ink">{finalLine(final)}</b>} {MIDWEEK.championTotal} KUT
            Coins over the night.{" "}
            {final && (
              <Link
                className="font-bold text-brass hover:underline"
                href={`/midweek/${tournament.week_start}/match/${final.match_id}`}
              >
                Report &rarr;
              </Link>
            )}
          </p>
          {championCards.length > 0 && (
            <div className="max-w-[760px]">
              <FiveCards
                cards={championCards.map((row) => entryCardFace(row, photoUrls))}
                label={`${championName}’s five`}
              />
            </div>
          )}
        </section>

        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-panel-2/70 to-panel/70 sm:grid-cols-4 [&>div]:px-4 [&>div]:py-3.5 max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(even)]:border-l sm:[&>div+div]:border-l [&>div]:border-line/50">
          <Stat
            label="You"
            note={picks > 0 ? `${coins} for wins, ${callCoins} for calls` : "paid to your wallet"}
            tone="brass"
            unit="KUT"
            value={`+${coins + callCoins}`}
          />
          <Stat label="Your finish" note={finish.note} value={finish.value} />
          <Stat
            label="Entrants"
            note={`${field.auto} auto squads`}
            value={String(field.entrants)}
          />
          <Stat label="Goals" note={`in ${totals.matches} matches`} value={String(totals.goals)} />
        </dl>

        <section aria-labelledby="night-h" className="grid gap-4">
          <MidweekSectionHead id="night-h" title="Your night">
            <Link
              className="text-sm font-bold text-brass hover:underline"
              href={`/midweek/${tournament.week_start}`}
            >
              Bracket and picks &rarr;
            </Link>
          </MidweekSectionHead>
          {night.entered ? (
            <MidweekPath
              now={now.toISOString()}
              rounds={rounds}
              rows={night.rows}
              weekStart={tournament.week_start}
            />
          ) : (
            <p className="text-sm text-ink-dim">You weren&rsquo;t in this one.</p>
          )}
          {picks > 0 && (
            <MidweekWeeklyCalls
              href={`/midweek/${tournament.week_start}#calls`}
              line={weeklyCallsLine(right, picks, perCall)}
            />
          )}
        </section>

        {ratings && <MidweekRatingList defaultOpen={false} ratings={ratings} />}
        <MidweekPlaceholder
          name="Share your night"
          note="An image for the group chat. It must say what it shows beyond the members-only pages (ADR-079)."
        />

        {next && next.lock_at && next.status === "open" && (
          <Link
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-brass/40 bg-brass-bg/28 px-3 py-2.5 hover:border-brass"
            href="/midweek?view=pick"
          >
            <MidweekMiniCard variant="unknown" />
            <span className="text-[13.5px] leading-snug text-ink-dim">
              <b className="block text-[14.5px] text-ink">Next Wednesday is open</b>
              Pick your five for {formatDayDate(next.lock_at)}. Locks at {formatClock(next.lock_at)}
              .
            </span>
            <span aria-hidden="true" className="text-xl font-black text-brass">
              &rarr;
            </span>
          </Link>
        )}

        <p>
          <Link className="text-sm font-bold text-brass hover:underline" href="/midweek/past">
            Past weeks &rarr;
          </Link>
        </p>

        {seal && (
          <MidweekSeed
            defaultOpen
            seed={seed}
            seedHash={seal}
            seedMatches={seed !== null && seedHash(seed) === seal}
          />
        )}
        <p className="text-[13px] text-ink-faint">{totals.coins} KUT Coins paid across the club.</p>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
  unit,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "brass";
  /** A small unit after the value: `+54 KUT` (DR3, round 2). */
  unit?: string;
}) {
  return (
    <div>
      <dt className="text-[10.4px] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[26px] font-black tracking-[-0.01em] tabular-nums ${tone === "brass" ? "text-brass" : ""}`}
      >
        {value}
        {unit && <span className="ml-1 text-sm font-extrabold tracking-normal">{unit}</span>}
        <small className="block text-xs font-bold tracking-normal text-ink-faint">{note}</small>
      </dd>
    </div>
  );
}
