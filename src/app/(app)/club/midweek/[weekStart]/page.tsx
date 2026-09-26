import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MidweekNotice } from "@/components/midweek/bits";
import { MidweekBracket, MidweekBracketLegend } from "@/components/midweek/bracket";
import { MidweekRevealClock } from "@/components/midweek/clock";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import { MidweekPickShares, type PickShareView } from "@/components/midweek/pick-shares";
import { MidweekSeed } from "@/components/midweek/seed";
import { MIDWEEK } from "@/game/midweek/config";
import { seedHash } from "@/game/midweek/rng";
import { revealAt } from "@/game/midweek/schedule";
import { getRarityTier } from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";
import { formatClock, formatDayDate, skipOrVoidNotice } from "@/lib/midweek/entry";
import {
  assembleBracket,
  isWeekStart,
  myNight,
  revealedRounds,
  revealStops,
  wonRounds,
} from "@/lib/midweek/evening";
import { loadPickShares, loadTournamentByWeek, loadWeekResults } from "@/lib/midweek/results";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness bracket" };

const PANEL = "rounded-2xl border border-line/60 bg-panel/60 p-5 sm:p-6";
const BACK = { href: "/club/midweek", label: "Midweek Madness" };

/**
 * `/club/midweek/[weekStart]`: one week's bracket (Bracket-Revealing,
 * Bracket-Complete). Rounds appear as they are revealed; after the week is
 * complete, the pick shares and the seed follow. Past weeks stay readable when
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
  const shell = (children: ReactNode, title = "The bracket") => (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
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

  const roundOne = formatClock(revealAt(new Date(lockAt), 1).toISOString());
  const rounds = tournament.rounds;
  if (tournament.status === "open" || !rounds) {
    return shell(
      <MidweekNotice tone="info">
        <b>The bracket is drawn at the lock</b>, {formatDayDate(lockAt)} at {formatClock(lockAt)}.
        Round 1 comes out at {roundOne}, then a round every half hour.
      </MidweekNotice>,
    );
  }

  const results = await loadWeekResults(supabase, tournament.tournament_id);
  const out = revealedRounds(results.matches);
  const now = new Date();
  const night = myNight({ userId: user.id, rounds, lockAt, matches: results.matches });
  const stops = revealStops({ lockAt, rounds, now, wonRounds: wonRounds(night) });
  const clock = (
    <section aria-label="Tonight" className={PANEL}>
      <MidweekRevealClock label="Jump to a round" linkRounds={out > 0} stops={stops} />
    </section>
  );
  if (out === 0) {
    return shell(
      <>
        {clock}
        <MidweekNotice tone="info">
          <b>Squads are locked.</b> The bracket is drawn and every match is already decided. Round 1
          comes out at {roundOne}.
        </MidweekNotice>
      </>,
    );
  }

  const bracket = assembleBracket({
    rounds,
    lockAt,
    matches: results.matches,
    autoUserIds: new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id)),
  });
  const complete = tournament.status === "complete";
  const shares = complete ? await loadPickShares(supabase, tournament.tournament_id) : [];
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
      {clock}
      <MidweekBracketLegend />
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
    </>,
    complete && tournament.champion_name ? `${tournament.champion_name} won it` : "The bracket",
  );
}
