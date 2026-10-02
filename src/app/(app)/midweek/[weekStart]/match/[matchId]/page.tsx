import Link from "next/link";
import { notFound } from "next/navigation";
import { MidweekNotice } from "@/components/midweek/bits";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import { ReportText } from "@/components/midweek/player-name";
import {
  MidweekLaneTimeline,
  MidweekScoreboard,
  MidweekShootout,
  type Managers,
} from "@/components/midweek/report";
import { MidweekWhyList } from "@/components/midweek/why-list";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import {
  formatClock,
  formatDayDate,
  scheduleVersionOf,
  skipOrVoidNotice,
} from "@/lib/midweek/entry";
import { capitalise, fiveOf, isWeekStart, matchName, roundName } from "@/lib/midweek/evening";
import { maskInPlay } from "@/lib/midweek/live";
import { loadLiveMatch, loadMatchEnds } from "@/lib/midweek/live-load";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { loadTournamentByWeek } from "@/lib/midweek/results";
import type { EntryCardRow, EventRow, MatchRow } from "@/lib/midweek/rows";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";
import { InPlayMatch } from "./in-play";
import { isUuid } from "@/lib/uuid";

export const metadata = { title: "Midweek Madness match report" };

/**
 * `/midweek/[weekStart]/match/[matchId]`: one match's report
 * (design/ux-review `Match-Other-FullTime`, ADR-111), rendered on the server
 * from the stored match, its events and both sides' lock-time entries, every
 * name in its side's colour. A match that isn't revealed yet, a bye or a void
 * week has no report. A match in play shows live, or as in play, without its
 * result (`InPlayMatch`, ADR-115).
 */
export default async function MidweekReportPage({
  params,
}: {
  params: Promise<{ weekStart: string; matchId: string }>;
}) {
  const user = await requireUser();
  await runDueMidweek();
  const { weekStart, matchId } = await params;
  // Both segments are checked before any query (KB-007).
  if (!isWeekStart(weekStart) || !isUuid(matchId)) notFound();
  const supabase = await createClient();
  const tournament = await loadTournamentByWeek(supabase, weekStart);
  if (!tournament) notFound();

  const back = {
    href: `/midweek/${weekStart}`,
    label: `${formatDayDate(tournament.lock_at)} bracket`,
  };
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) {
    return (
      <main className={MIDWEEK_PAGE}>
        <section className="mx-auto grid max-w-3xl gap-8 py-4 sm:py-8">
          <MidweekPageHead
            back={back}
            kicker={`Midweek Madness · ${formatDayDate(tournament.lock_at)}`}
            title="Match report"
          />
          <MidweekNotice tone={notice.tone}>
            <b>{notice.lead}</b> {notice.rest}
          </MidweekNotice>
        </section>
      </main>
    );
  }
  if (!tournament.rounds) notFound();

  const [matchResponse, eventsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_matches_public")
      .select("*")
      .eq("tournament_id", tournament.tournament_id)
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("midweek_events_public")
      .select("*")
      .eq("match_id", matchId)
      .order("seq"),
  ]);
  if (matchResponse.error || eventsResponse.error) throw new Error("Could not load this match.");
  const match = matchResponse.data as MatchRow | null;
  // Not revealed yet reads as zero rows, the same as no such match.
  if (!match || match.bye || match.side_1_user_id === null) notFound();

  const entriesResponse = await supabase
    .schema("kut")
    .from("midweek_entries_public")
    .select("*")
    .eq("tournament_id", tournament.tournament_id)
    .in("user_id", [match.side_0_user_id, match.side_1_user_id]);
  if (entriesResponse.error) throw new Error("Could not load this match's squads.");

  // A match in play shows no result before its full time (ADR-106, ADR-115):
  // live, chance by chance, for the member's own match and the final; any
  // other match as "in play".
  const now = new Date();
  const ends =
    tournament.status === "simulated"
      ? await loadMatchEnds(tournament.tournament_id)
      : new Map<string, string | null>();
  const [shown] = maskInPlay([match], ends, now);
  if (shown.in_play) {
    const entries = (entriesResponse.data ?? []) as EntryCardRow[];
    const rounds = tournament.rounds;
    const isFinal = shown.round === rounds;
    const yours =
      shown.side_0_user_id === user.id ? 0 : shown.side_1_user_id === user.id ? 1 : null;
    const watched = isFinal || yours !== null;
    const live = await loadLiveMatch(supabase, {
      tournament: {
        tournament_id: tournament.tournament_id,
        seed_hash: tournament.seed_hash,
        rounds,
      },
      scheduleVersion: scheduleVersionOf(tournament),
      match: shown,
      now,
    });
    const name = roundName(shown.round, rounds);
    const autoOf = (id: string | null) => entries.some((row) => row.user_id === id && row.auto);
    return (
      <InPlayMatch
        auto={[autoOf(shown.side_0_user_id), autoOf(shown.side_1_user_id)]}
        back={back}
        fives={[shown.side_0_user_id, shown.side_1_user_id].flatMap((id) => {
          const five = id ? fiveOf(entries, id) : null;
          return five ? [five] : [];
        })}
        kicker={
          isFinal
            ? "The final · live"
            : watched
              ? `${name} · your match · live`
              : `${name} · in play`
        }
        live={live}
        managers={[shown.side_0_name, shown.side_1_name ?? ""]}
        now={now.toISOString()}
        watched={watched}
        youSide={yours}
      />
    );
  }

  const input = reportInputFromRows({
    seedHash: tournament.seed_hash ?? "",
    rounds: tournament.rounds,
    match,
    events: (eventsResponse.data ?? []) as EventRow[],
    entries: (entriesResponse.data ?? []) as EntryCardRow[],
    // Owner counts are published once the week is complete (D3).
    ownersPublished: tournament.status === "complete",
  });
  if (!input) notFound();
  const report = renderStoredReport(input);
  const managers: Managers = [input.sides[0].manager, input.sides[1].manager];
  const youSide =
    match.side_0_user_id === user.id ? 0 : match.side_1_user_id === user.id ? 1 : null;

  return (
    <main className={MIDWEEK_PAGE}>
      <article className="mx-auto grid max-w-6xl gap-5 py-4 sm:gap-6 sm:py-8">
        <header className="grid gap-3">
          <Link
            className="justify-self-start text-sm font-bold text-brass hover:underline"
            href={back.href}
          >
            &larr; {back.label}
          </Link>
          <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            {capitalise(matchName(match.round, match.pairing, tournament.rounds))} &middot; out at{" "}
            {formatClock(match.reveal_at)}
          </p>
          <h1 className="display text-[30px] text-pretty sm:text-[46px]">
            <ReportText parts={report.headlineParts} />
          </h1>
        </header>
        <MidweekScoreboard
          auto={[input.sides[0].auto, input.sides[1].auto]}
          goals={input.outcome.goals}
          managers={managers}
          penalties={input.outcome.penalties}
          winnerSide={input.outcome.winnerSide}
          youSide={youSide}
        />
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="grid min-w-0 content-start gap-7">
            {report.facts.length > 0 && (
              <ul className="grid gap-1.5">
                {report.facts.map((fact, index) => (
                  <li
                    className="border-l-2 border-brass-line pl-3 font-serif text-lg leading-[1.35] text-pretty text-ink"
                    key={index}
                  >
                    <ReportText parts={fact.parts} />
                  </li>
                ))}
              </ul>
            )}
            <section aria-labelledby="timeline-h" className="grid gap-4">
              <h2 className="display text-3xl" id="timeline-h">
                How it went
              </h2>
              <MidweekLaneTimeline managers={managers} timeline={report.timeline} />
            </section>
            {report.shootout && <MidweekShootout managers={managers} shootout={report.shootout} />}
          </div>
          <aside className="min-w-0">
            <MidweekWhyList why={report.why} />
          </aside>
        </div>
      </article>
    </main>
  );
}
