import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "./attendance-form";

type AttendancePageProps = {
  searchParams: Promise<{ cancelled?: string; corrected?: string; published?: string; reactivated?: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const [admin, supabase, query] = await Promise.all([
    requireAdmin(),
    createClient(),
    searchParams,
  ]);
  const [playersResponse, sessionsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("players")
      .select("id, display_name")
      .eq("is_active", true)
      .order("display_name"),
    supabase
      .schema("kut")
      .from("match_sessions")
      .select("id, session_date, session_type, status, rating_rules_version")
      .in("status", ["published", "cancelled"])
      .order("session_date", { ascending: false })
      .limit(12),
  ]);

  if (playersResponse.error || sessionsResponse.error) {
    throw new Error("Could not load the active player roster.");
  }

  const { data: activeSeason, error: seasonError } = await supabase
    .schema("kut")
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  const [{ data: ratingRules, error: rulesError }, { data: publishedSession, error: publishedError }] = await Promise.all([
    activeSeason
      ? supabase.schema("kut").from("season_rating_rules").select("v2_starts_week").eq("season_id", activeSeason.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    query.published && UUID_RE.test(query.published)
      ? supabase.schema("kut").from("match_sessions").select("id, rating_rules_version").eq("id", query.published).eq("status", "published").maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (seasonError || rulesError || publishedError) throw new Error("Could not load the reporting cutover.");

  const players = playersResponse.data ?? [];
  const sessions = sessionsResponse.data ?? [];
  const cutoverLabel = ratingRules?.v2_starts_week
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(`${ratingRules.v2_starts_week}T12:00:00`))
    : null;

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Record attendance</h1>
          <p className="text-ink-dim">Signed in as {admin.displayName}. Publishing rebuilds every Live Card from season history.</p>
        </header>
        {query.published && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            {publishedSession?.rating_rules_version === 2
              ? <>Session published. Member reports are open for 24 hours. <Link className="underline" href={`/admin/attendance/${publishedSession.id}/reports`}>Review reports &rarr;</Link></>
              : <>Legacy session published. Player ratings were rebuilt, but no member report was opened{cutoverLabel ? ` because reports begin with the week of ${cutoverLabel}` : ""}.</>}
          </p>
        )}
        {query.corrected === "1" && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            Correction saved. The previous record is retained in the audit log; published sessions rebuild Player Ratings immediately.
          </p>
        )}
        {query.cancelled === "1" && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            Session cancelled. It remains in the audit trail and no longer affects Player Ratings.
          </p>
        )}
        {query.reactivated === "1" && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            Session reactivated. Its attendance now affects Player Ratings again.
          </p>
        )}
        <AttendanceForm players={players} v2StartsWeek={ratingRules?.v2_starts_week ?? null} />

        <section className="space-y-3 border-t border-panel-2 pt-8">
          <h2 className="display text-2xl">Review published and cancelled sessions</h2>
          <p className="text-sm leading-6 text-ink-dim">Open a session to amend attendance, date, or type. New-rule goals are managed under Session reports. Cancelled sessions stay available for review and reactivation.</p>
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-panel p-4 text-ink-dim">No published or cancelled sessions are available yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-panel px-4 font-semibold hover:border-brass"
                    href={`/admin/attendance/${session.id}`}
                  >
                    <span>{session.session_date} · {session.session_type}</span>
                    <span className={session.status === "cancelled" ? "text-brick" : "text-brass"}>
                      {session.status === "cancelled" ? "Cancelled · review →" : "Published · correct →"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
