import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "./attendance-form";

type AttendancePageProps = {
  searchParams: Promise<{ cancelled?: string; corrected?: string; published?: string; reactivated?: string }>;
};

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
      .select("id, session_date, session_type, status")
      .in("status", ["published", "cancelled"])
      .order("session_date", { ascending: false })
      .limit(12),
  ]);

  if (playersResponse.error || sessionsResponse.error) {
    throw new Error("Could not load the active player roster.");
  }

  const players = playersResponse.data ?? [];
  const sessions = sessionsResponse.data ?? [];

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Record attendance</h1>
          <p className="text-ink-dim">Signed in as {admin.displayName}. Publishing rebuilds every Live Card from season history.</p>
        </header>
        {query.published === "1" && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            Session published. Player ratings have been rebuilt from the full season history.
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
        <AttendanceForm players={players} />

        <section className="space-y-3 border-t border-panel-2 pt-8">
          <h2 className="display text-2xl">Review published and cancelled sessions</h2>
          <p className="text-sm leading-6 text-ink-dim">Open a session to amend attendance, goals, date, or type. Cancelled sessions stay available for review and reactivation.</p>
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
