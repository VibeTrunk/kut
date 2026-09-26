import Link from "next/link";
import { notFound } from "next/navigation";
import { MidweekNotice } from "@/components/midweek/bits";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import {
  MidweekScoreboard,
  MidweekShootout,
  MidweekTimeline,
  MidweekWhyPanel,
  type Managers,
} from "@/components/midweek/report";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { formatClock, formatDayDate, skipOrVoidNotice } from "@/lib/midweek/entry";
import { capitalise, isWeekStart, matchName } from "@/lib/midweek/evening";
import { reportInputFromRows, renderStoredReport } from "@/lib/midweek/report/from-db";
import { loadTournamentByWeek } from "@/lib/midweek/results";
import type { EntryCardRow, EventRow, MatchRow } from "@/lib/midweek/rows";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export const metadata = { title: "Midweek Madness match report" };

/**
 * `/club/midweek/[weekStart]/match/[matchId]`: one match's report
 * (Report-Thrashing, Report-Shootout, Report-Injured), rendered on the server
 * from the stored match, its events and both sides' lock-time entries. A match
 * that isn't revealed yet, a bye or a void week has no report.
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
    href: `/club/midweek/${weekStart}`,
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
      <div className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <Link
          className="justify-self-start text-sm font-bold text-brass hover:underline"
          href={back.href}
        >
          &larr; {back.label}
        </Link>
        <article className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
          <div className="grid min-w-0 content-start gap-7">
            <header className="grid gap-3.5 border-t-4 border-brass pt-4">
              <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
                {capitalise(matchName(match.round, match.pairing, tournament.rounds))} &middot; out
                at {formatClock(match.reveal_at)}
              </p>
              <h1 className="display text-[34px] text-pretty sm:text-[52px]">{report.headline}</h1>
              <MidweekScoreboard
                auto={[input.sides[0].auto, input.sides[1].auto]}
                goals={input.outcome.goals}
                managers={managers}
                penalties={input.outcome.penalties}
                winnerSide={input.outcome.winnerSide}
                youSide={youSide}
              />
              {report.facts.length > 0 && (
                <ul className="grid gap-2">
                  {report.facts.map((fact, index) => (
                    <li
                      className="border-l-2 border-brass-line pl-4 font-serif text-xl leading-tight text-pretty text-ink"
                      key={index}
                    >
                      {fact.text}
                    </li>
                  ))}
                </ul>
              )}
            </header>
            <section aria-labelledby="timeline-h" className="grid gap-4">
              <h2 className="display text-3xl" id="timeline-h">
                How it went
              </h2>
              <MidweekTimeline managers={managers} timeline={report.timeline} />
            </section>
            {report.shootout && <MidweekShootout managers={managers} shootout={report.shootout} />}
          </div>
          <aside className="grid min-w-0 content-start gap-7">
            <MidweekWhyPanel why={report.why} />
          </aside>
        </article>
      </div>
    </main>
  );
}
