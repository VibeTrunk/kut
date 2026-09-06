import Link from "next/link";
import { notFound } from "next/navigation";
import { RARITY_BANDS, type RarityTier } from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";
import { formatChronicleDate, isMonday, issueStandfirst } from "@/lib/chronicle";
import { finalizeDueSurveys } from "@/lib/session-reports/finalize-due-surveys";
import { createClient } from "@/lib/supabase/server";

type Week = { week_start: string; week_end: string; session_count: number; appearance_count: number; goal_count: number };
type Session = { id: string; session_date: string; session_type: string; bibs_washed_by: string | null; rating_rules_version: number };
type Attendance = { session_id: string; player_id: string; goals: number; players: { display_name: string; slug: string } | null };
type ReportResult = { session_id: string; player_id: string; display_name: string; slug: string; effective_goals: number | null; recognized_categories: string[]; submitted_reports: number; eligible_accounts: number; attendee_count: number };
type ReportProgress = { session_id: string; survey_status: string; closes_at: string; attendee_count: number; submitted_reports: number; eligible_accounts: number; goal_total: number; accepting_reports: boolean };
type MyReport = { session_id: string; report_status: string | null };
type Crossing = { player_id: string; slug: string; display_name: string; from_tier: RarityTier; to_tier: RarityTier; live_ovr: number };

const TYPE: Record<string, string> = { monday: "Monday", friday: "Friday", other: "Session" };
// Tier order for "did this player move up?" — derived so it cannot drift from the
// rarity bands the rest of the app renders.
const TIERS: RarityTier[] = RARITY_BANDS.map((band) => band.tier);

export const metadata = { title: "Chronicle issue" };

function TierLabel({ tier }: { tier: RarityTier }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="tier-chip" data-rarity={tier}><span /></span><span>{tier}</span></span>;
}

function groupBySession<T extends { session_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.session_id);
    if (bucket) bucket.push(row);
    else grouped.set(row.session_id, [row]);
  }
  return grouped;
}

function reportCloseLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export default async function ChronicleIssuePage({ params }: { params: Promise<{ week: string }> }) {
  await requireUser();
  const { week } = await params;
  if (!isMonday(week)) notFound();
  // Finalize any survey whose window has closed before we read this issue, so a
  // just-closed session shows finalized results rather than "being prepared".
  await finalizeDueSurveys();
  const supabase = await createClient();
  const { data: issue, error } = await supabase
    .schema("kut")
    .from("chronicle_weeks")
    .select("week_start,week_end,session_count,appearance_count,goal_count")
    .eq("week_start", week)
    .maybeSingle();
  if (error) throw new Error("Could not load this Chronicle issue.");
  if (!issue) notFound();
  const current = issue as Week;

  const [sessionsResponse, crossingsResponse] = await Promise.all([
    supabase.schema("kut").from("match_sessions").select("id,session_date,session_type,bibs_washed_by,rating_rules_version").eq("status", "published").gte("session_date", current.week_start).lte("session_date", current.week_end).order("session_date"),
    supabase.schema("kut").from("chronicle_tier_changes").select("player_id,slug,display_name,from_tier,to_tier,live_ovr").eq("week_start", week),
  ]);
  if (sessionsResponse.error || crossingsResponse.error) throw new Error("Could not load the matchday reports.");
  const sessions = (sessionsResponse.data ?? []) as Session[];
  const sessionIds = sessions.map((session) => session.id);

  const [attendanceResponse, resultsResponse, progressResponse, myReportsResponse] = await Promise.all([
    supabase.schema("kut").from("attendance").select("session_id,player_id,goals,players(display_name,slug)").in("session_id", sessionIds),
    supabase.schema("kut").from("chronicle_session_reports").select("session_id,player_id,display_name,slug,effective_goals,recognized_categories,submitted_reports,eligible_accounts,attendee_count").in("session_id", sessionIds),
    supabase.schema("kut").from("chronicle_session_report_status").select("session_id,survey_status,closes_at,attendee_count,submitted_reports,eligible_accounts,goal_total,accepting_reports").in("session_id", sessionIds),
    supabase.schema("kut").from("my_session_reports").select("session_id,report_status").in("session_id", sessionIds),
  ]);
  if (attendanceResponse.error || resultsResponse.error || progressResponse.error || myReportsResponse.error) {
    throw new Error("Could not load session reporting progress.");
  }

  const attendanceBySession = groupBySession((attendanceResponse.data ?? []) as unknown as Attendance[]);
  const resultsBySession = groupBySession((resultsResponse.data ?? []) as ReportResult[]);
  const progressBySession = new Map(((progressResponse.data ?? []) as ReportProgress[]).map((row) => [row.session_id, row]));
  const myReportBySession = new Map(((myReportsResponse.data ?? []) as MyReport[]).map((row) => [row.session_id, row]));
  const hasUnfinalizedReports = ((progressResponse.data ?? []) as ReportProgress[]).some((row) => row.survey_status !== "finalized");
  const crossings = ((crossingsResponse.data ?? []) as Crossing[]).filter((row) => TIERS.indexOf(row.to_tier) > TIERS.indexOf(row.from_tier));

  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl space-y-12 py-4 sm:py-8">
    <Link className="text-sm font-bold text-brass hover:underline" href="/chronicle">&larr; All issues</Link>
    <header className="border-y-4 border-brass py-5"><div className="flex items-end justify-between gap-4"><h1 className="display text-5xl sm:text-6xl">KUT Chronicle</h1><p className="text-right font-black text-brass">Week of {formatChronicleDate(current.week_start)}</p></div><p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-ink-faint">{formatChronicleDate(current.week_start)} &ndash; {formatChronicleDate(current.week_end, { day: "numeric", month: "long", year: "numeric" })}</p><p className="display mt-7 text-3xl text-ink-dim">{issueStandfirst(current.session_count, current.appearance_count, current.goal_count)}</p>{hasUnfinalizedReports && <p className="mt-3 text-sm font-bold text-brass">The goal total is provisional until reporting is finalized.</p>}</header>

    {sessions.map((session, index) => {
      const attendance = (attendanceBySession.get(session.id) ?? []).sort((a, b) => b.goals - a.goals || (a.players?.display_name ?? "").localeCompare(b.players?.display_name ?? ""));
      const results = (resultsBySession.get(session.id) ?? []).sort((a, b) => (b.effective_goals ?? 0) - (a.effective_goals ?? 0) || a.display_name.localeCompare(b.display_name));
      const progress = progressBySession.get(session.id);
      const myReport = myReportBySession.get(session.id);
      const reportsOpen = progress?.accepting_reports === true;
      const reportsFinalized = progress?.survey_status === "finalized";
      const goals = session.rating_rules_version === 2
        ? progress?.goal_total ?? 0
        : attendance.reduce((sum, row) => sum + row.goals, 0);
      const bibs = session.bibs_washed_by ? attendance.find((row) => row.player_id === session.bibs_washed_by)?.players?.display_name : null;
      const goalLabel = session.rating_rules_version === 2 && reportsOpen ? "goals reported so far" : session.rating_rules_version === 2 ? "reported goals" : "goals";

      return <article className="border-b border-line/40 pb-10" id={`s-${session.id}`} key={session.id}>
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-brass">Matchday {index + 1} &middot; {TYPE[session.session_type] ?? "Session"}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><h2 className="display text-4xl">{formatChronicleDate(session.session_date)}</h2><p className="font-black tabular-nums text-ink-dim">{attendance.length} attended &middot; {goals} {goalLabel}</p></div>
        {bibs && <p className="mt-5 rounded-xl border border-brass-line bg-brass-bg/30 px-4 py-3 text-sm text-ink-dim">Bibs brought by <span className="font-black text-brass">{bibs}</span></p>}

        {session.rating_rules_version === 2 ? (
          reportsFinalized ? (
            results.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-line p-4 text-sm text-ink-dim">Results finalized. No report results were recorded.</p> : <>
              <p className="mt-6 text-sm font-bold text-ink-dim">{progress?.submitted_reports ?? results[0].submitted_reports} of {progress?.eligible_accounts ?? results[0].eligible_accounts} reports submitted &middot; {progress?.attendee_count ?? results[0].attendee_count} attendees</p>
              <ol className="mt-3 grid gap-x-10 sm:grid-cols-2">{results.map((row) => <li className="border-b border-line/30 py-3" key={row.player_id}><div className="flex justify-between gap-4"><Link className="font-semibold hover:text-brass hover:underline" href={`/players/${row.slug}`}>{row.display_name}</Link><span className="font-bold tabular-nums text-brass">{row.effective_goals === null ? "Not reported" : `${row.effective_goals} ${row.effective_goals === 1 ? "goal" : "goals"}`}</span></div>{row.recognized_categories.length > 0 && <p className="mt-1 text-xs font-bold text-steel">{row.recognized_categories.join(" · ")}</p>}</li>)}</ol>
            </>
          ) : reportsOpen ? (
            <section className="mt-6 rounded-xl border border-brass-line bg-brass-bg/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-brass">Reports open</p><p className="mt-1 text-sm text-ink-dim">{progress?.submitted_reports ?? 0} of {progress?.eligible_accounts ?? 0} reports submitted &middot; closes {progress ? reportCloseLabel(progress.closes_at) : "soon"}</p></div>{myReport && <Link className="inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-black text-ink-on-accent" href={`/sessions/${session.id}/report`}>{myReport.report_status === "submitted" ? "View your report" : "Add goals & kudos"}</Link>}</div>
              <p className="mt-3 text-sm text-ink-faint">{goals} goals reported so far. Final player results and recognized kudos appear after reporting closes.</p>
            </section>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-line p-4 text-sm text-ink-dim">Reports closed &middot; {progress?.submitted_reports ?? 0} of {progress?.eligible_accounts ?? 0} submitted &middot; results are being prepared.</p>
          )
        ) : attendance.length === 0 ? <p className="mt-6 text-ink-dim">No attendance was recorded.</p> : <ol className="mt-6 grid gap-x-10 sm:grid-cols-2">{attendance.map((row) => <li className="flex justify-between gap-4 border-b border-line/30 py-2.5" key={row.player_id}>{row.players?.slug ? <Link className="font-semibold hover:text-brass hover:underline" href={`/players/${row.players.slug}`}>{row.players.display_name}</Link> : <span>{row.players?.display_name ?? "A player"}</span>}<span className="font-bold tabular-nums text-brass">{row.goals ? `${row.goals} ${row.goals === 1 ? "goal" : "goals"}` : "—"}</span></li>)}</ol>}
      </article>;
    })}

    {crossings.length > 0 && <section><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-brass">This week&rsquo;s promotions</p><h2 className="display mt-2 text-4xl">Crossings</h2><p className="mt-2 text-sm text-ink-dim">Ratings move once per football week. Every copy in the club changed with them.</p><ol className="mt-6 space-y-3">{crossings.map((row) => <li className="grid gap-3 rounded-2xl border border-line bg-panel/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={row.player_id}><Link className="min-w-0 truncate font-black hover:text-brass" href={`/players/${row.slug}`}>{row.display_name}</Link><span className="flex min-w-0 items-center gap-2 text-[0.65rem] font-extrabold uppercase tracking-[0.08em]"><TierLabel tier={row.from_tier} /><span aria-hidden="true" className="text-ink-faint">&rarr;</span><TierLabel tier={row.to_tier} /><b className="ml-auto text-xl tabular-nums text-brass sm:ml-2">{row.live_ovr}</b></span></li>)}</ol></section>}
  </section></main>;
}
