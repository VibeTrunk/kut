import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "../attendance-form";
import { CancelSessionForm } from "./cancel-session-form";
import { ReactivateSessionForm } from "./reactivate-session-form";

type CorrectionPageProps = {
  params: Promise<{ sessionId: string }>;
};

type PublishedSession = {
  id: string;
  session_date: string;
  session_type: string;
  status: "published" | "cancelled";
  attendance: Array<{ goals: number; player_id: string }> | null;
};

export default async function CorrectionPage({ params }: CorrectionPageProps) {
  await requireAdmin();
  const { sessionId } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    notFound();
  }

  const supabase = await createClient();
  const [sessionResponse, playersResponse, correctionsResponse, statusEventsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("match_sessions")
      .select("id, session_date, session_type, status, attendance(player_id, goals)")
      .eq("id", sessionId)
      .in("status", ["published", "cancelled"])
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("players")
      .select("id, display_name, is_active")
      .order("display_name"),
    supabase
      .schema("kut")
      .from("session_corrections")
      .select("id, reason, corrected_at")
      .eq("session_id", sessionId)
      .order("corrected_at", { ascending: false }),
    supabase
      .schema("kut")
      .from("session_status_events")
      .select("id, event_type, reason, occurred_at")
      .eq("session_id", sessionId)
      .order("occurred_at", { ascending: false }),
  ]);

  if (sessionResponse.error || playersResponse.error || correctionsResponse.error || statusEventsResponse.error) {
    throw new Error("Could not load this session.");
  }

  if (!sessionResponse.data) notFound();

  const session = sessionResponse.data as PublishedSession;
  const corrections = correctionsResponse.data ?? [];
  const statusEvents = statusEventsResponse.data ?? [];
  const originalAttendeeIds = new Set((session.attendance ?? []).map((entry) => entry.player_id));
  const correctionPlayers = (playersResponse.data ?? []).filter(
    (player) => player.is_active || originalAttendeeIds.has(player.id),
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <Link className="text-sm font-semibold text-amber-400" href="/admin/attendance">← Admin attendance</Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Admin correction</p>
          <h1 className="text-4xl font-black tracking-tight">{session.status === "cancelled" ? "Review cancelled session" : "Correct published session"}</h1>
          <p className="text-slate-300">
            {session.status === "cancelled"
              ? "You can update this record before reactivating it. It will not affect Live Ratings while cancelled."
              : "Update the original record carefully. Saving rebuilds Live Ratings immediately and preserves the prior record in the audit log."}
          </p>
        </header>

        <AttendanceForm
          correctionSession={{
            id: session.id,
            sessionDate: session.session_date,
            sessionType: session.session_type,
            status: session.status,
            attendance: session.attendance ?? [],
          }}
          players={correctionPlayers}
        />

        {corrections.length > 0 && (
          <section className="space-y-3 border-t border-slate-800 pt-8">
            <h2 className="text-xl font-bold">Correction history</h2>
            <ul className="space-y-2">
              {corrections.map((correction) => (
                <li className="rounded-xl bg-slate-900 p-4 text-sm text-slate-300" key={correction.id}>
                  <p className="font-semibold text-slate-50">{correction.reason}</p>
                  <p className="mt-1">{new Date(correction.corrected_at).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {statusEvents.length > 0 && (
          <section className="space-y-3 border-t border-slate-800 pt-8">
            <h2 className="text-xl font-bold">Status history</h2>
            <ul className="space-y-2">
              {statusEvents.map((event) => (
                <li className="rounded-xl bg-slate-900 p-4 text-sm text-slate-300" key={event.id}>
                  <p className="font-semibold capitalize text-slate-50">{event.event_type}</p>
                  <p className="mt-1">{event.reason}</p>
                  <p className="mt-1">{new Date(event.occurred_at).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {session.status === "cancelled" ? (
          <ReactivateSessionForm sessionId={session.id} />
        ) : (
          <CancelSessionForm sessionId={session.id} />
        )}
      </section>
    </main>
  );
}
