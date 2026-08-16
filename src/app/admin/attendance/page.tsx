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
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold">
          <Link className="text-amber-400" href="/">← Player ratings</Link>
          <div className="flex gap-4">
            <Link className="text-amber-400" href="/admin/accounts">Accounts</Link>
            <Link className="text-amber-400" href="/admin/economy">Economy</Link>
            <Link className="text-amber-400" href="/admin/invites">Manage invites →</Link>
          </div>
        </div>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Admin</p>
          <h1 className="text-4xl font-black tracking-tight">Record attendance</h1>
          <p className="text-slate-300">Signed in as {admin.displayName}. Publishing rebuilds every Live Card from season history.</p>
        </header>
        {query.published === "1" && (
          <p className="rounded-xl bg-emerald-950 p-4 font-semibold text-emerald-200">
            Session published. Player ratings have been rebuilt from the full season history.
          </p>
        )}
        {query.corrected === "1" && (
          <p className="rounded-xl bg-emerald-950 p-4 font-semibold text-emerald-200">
            Correction saved. The previous record is retained in the audit log; published sessions rebuild Player Ratings immediately.
          </p>
        )}
        {query.cancelled === "1" && (
          <p className="rounded-xl bg-emerald-950 p-4 font-semibold text-emerald-200">
            Session cancelled. It remains in the audit trail and no longer affects Player Ratings.
          </p>
        )}
        {query.reactivated === "1" && (
          <p className="rounded-xl bg-emerald-950 p-4 font-semibold text-emerald-200">
            Session reactivated. Its attendance now affects Player Ratings again.
          </p>
        )}
        <AttendanceForm players={players} />

        <section className="space-y-3 border-t border-slate-800 pt-8">
          <h2 className="text-xl font-bold">Review published and cancelled sessions</h2>
          <p className="text-sm leading-6 text-slate-300">Open a session to amend attendance, goals, date, or type. Cancelled sessions stay available for review and reactivation.</p>
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-slate-900 p-4 text-slate-300">No published or cancelled sessions are available yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    className="flex min-h-12 items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 font-semibold hover:border-amber-400"
                    href={`/admin/attendance/${session.id}`}
                  >
                    <span>{session.session_date} · {session.session_type}</span>
                    <span className={session.status === "cancelled" ? "text-rose-300" : "text-amber-400"}>
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
