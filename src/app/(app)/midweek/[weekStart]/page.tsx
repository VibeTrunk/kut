import { CompeteTabs } from "@/components/app-shell/compete-tabs";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MidweekNotice } from "@/components/midweek/bits";
import { MidweekBracket } from "@/components/midweek/bracket";
import { MidweekClock } from "@/components/midweek/clock";
import { MidweekJumpLinks } from "@/components/midweek/jump-links";
import { MidweekLivePoller } from "@/components/midweek/live-poller";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import { MidweekPickShares, type PickShareView } from "@/components/midweek/pick-shares";
import { MidweekRatingList } from "@/components/midweek/rating-list";
import { MidweekSeed } from "@/components/midweek/seed";
import { MIDWEEK } from "@/game/midweek/config";
import { seedHash } from "@/game/midweek/rng";
import { roundStartAt } from "@/game/midweek/schedule";
import { getRarityTier } from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";
import {
  formatClock,
  formatDayDate,
  roundIntervalText,
  scheduleVersionOf,
  skipOrVoidNotice,
} from "@/lib/midweek/entry";
import {
  assembleBracket,
  eveningStops,
  isWeekStart,
  myNight,
  roundsYouAreIn,
  yourNextRound,
} from "@/lib/midweek/evening";
import {
  loadNightRatings,
  loadPickShares,
  loadTournamentByWeek,
  loadWeekResults,
} from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness bracket" };

const BACK = { href: "/midweek", label: "Midweek Madness" };

/**
 * `/midweek/[weekStart]`: one week's bracket (Bracket-FromLock,
 * Bracket-Evening, Bracket-Complete). From the lock round 1 shows as drawn,
 * with every kick-off (ADR-105, ADR-113); while the evening runs the sticky
 * clock leads and jump links take you to your match. After the week is
 * complete, the member's ratings lead (Bracket-Complete, DR3, ADR-117; this is
 * how they outlive Thursday), and the pick shares and the seed follow. Past weeks stay readable when
 * Midweek Madness is switched off, as history (HANDOFF question 6, ADR-097),
 * and a void week shows only its notice (§44.9).
 */
export default async function MidweekBracketPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const user = await requireUser();
  await runDueMidweek();
  const { weekStart } = await params;
  if (!isWeekStart(weekStart)) notFound();
  const supabase = await createClient();
  const tournament = await loadTournamentByWeek(supabase, weekStart);
  if (!tournament) notFound();

  const lockAt = tournament.lock_at;
  const kicker = `Midweek Madness · ${formatDayDate(lockAt)}`;
  const shell = (children: ReactNode, title = "The bracket", clock: ReactNode = null) => (
    <main className={MIDWEEK_PAGE}>
      {clock}
      <section
        className={`mx-auto grid max-w-6xl gap-8 sm:gap-11 ${clock ? "pb-4 sm:pb-8" : "py-4 sm:py-8"}`}
      >
        <CompeteTabs />
        <MidweekPageHead back={BACK} kicker={kicker} title={title} />
        {children}
      </section>
    </main>
  );

  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) {
    return shell(
      <MidweekNotice tone={notice.tone}>
        <b>{notice.lead}</b> {notice.rest}
      </MidweekNotice>,
    );
  }

  const scheduleVersion = scheduleVersionOf(tournament);
  const roundOne = formatClock(roundStartAt(new Date(lockAt), 1, scheduleVersion).toISOString());
  const rounds = tournament.rounds;
  if (tournament.status === "open" || !rounds) {
    return shell(
      <MidweekNotice tone="info">
        <b>The bracket is drawn at the lock</b>, {formatDayDate(lockAt)} at {formatClock(lockAt)}.
        Round 1 kicks off at {roundOne}, then a round {roundIntervalText(scheduleVersion)}.
      </MidweekNotice>,
    );
  }

  const now = new Date();
  const results = await loadWeekResults(supabase, tournament.tournament_id, now);
  const bracket = assembleBracket({
    rounds,
    lockAt,
    scheduleVersion,
    draw: results.draw,
    matches: results.matches,
    autoUserIds: new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id)),
  });
  const evening = tournament.status === "simulated";
  let clock: ReactNode = null;
  if (evening) {
    const night = myNight({
      userId: user.id,
      rounds,
      lockAt,
      scheduleVersion,
      matches: results.matches,
    });
    const entered = bracket[0].pairs.some((pair) =>
      pair.sides.some((side) => side.userId === user.id),
    );
    // While a match is in play the bracket asks for itself every 20 seconds,
    // otherwise once at the next kick-off (ADR-115).
    const inPlay = bracket.some((round) => round.pairs.some((pair) => pair.kind === "inplay"));
    const nextKickoff =
      bracket.find((round) => Date.parse(round.kickoffAt) > now.getTime())?.kickoffAt ?? null;
    clock = (
      <MidweekClock
        updated={<MidweekLivePoller at={now.toISOString()} nextAt={nextKickoff} poll={inPlay} />}
        stops={eveningStops({
          lockAt,
          scheduleVersion,
          rounds,
          now,
          matches: results.matches,
          youThrough: roundsYouAreIn(night, entered, rounds),
        })}
      />
    );
  }
  const complete = tournament.status === "complete";
  const [shares, ratings] = complete
    ? await Promise.all([
        loadPickShares(supabase, tournament.tournament_id),
        loadNightRatings(supabase, tournament, results, user.id),
      ])
    : [[], null];
  // The chip's tier comes from the locked OVR of an entered copy, never today's rating.
  const lockedOvr = new Map(
    results.entries.flatMap((row) => (row.player_id ? [[row.player_id, row.ovr] as const] : [])),
  );
  const shareRows: PickShareView[] = shares.map((share) => {
    const ovr = lockedOvr.get(share.player_id);
    return {
      playerId: share.player_id,
      name: share.player_name,
      rarity: ovr === undefined ? null : getRarityTier(ovr),
      picks: share.picks,
      owners: share.owners,
      pickFactorPpm: share.pick_factor_ppm,
    };
  });
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";

  return shell(
    <>
      <MidweekJumpLinks
        blocks={ratings ? [{ href: "#ratings", label: "Your ratings" }] : []}
        rounds={bracket}
        yours={evening ? yourNextRound(bracket, user.id) : null}
      />
      {ratings && <MidweekRatingList defaultOpen ratings={ratings} />}
      <MidweekBracket rounds={bracket} weekStart={weekStart} you={user.id} />
      {complete && shareRows.length > 0 && (
        <MidweekPickShares ownerCountMin={MIDWEEK.ownerCountMin} rows={shareRows} />
      )}
      {complete && seal && (
        <MidweekSeed
          seed={seed}
          seedHash={seal}
          seedMatches={seed !== null && seedHash(seed) === seal}
        />
      )}
      {evening && seal && <MidweekSeed seedHash={seal} />}
    </>,
    complete && tournament.champion_name ? `${tournament.champion_name} won it` : "The bracket",
    clock,
  );
}
