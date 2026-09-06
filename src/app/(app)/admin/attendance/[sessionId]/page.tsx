import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AttendanceForm } from "../attendance-form";
import { CancelSessionForm } from "./cancel-session-form";
import { ReactivateSessionForm } from "./reactivate-session-form";
import { isUuid } from "@/lib/uuid";

type CorrectionPageProps = {
  params: Promise<{ sessionId: string }>;
};

type PublishedSession = {
  id: string;
  session_date: string;
  session_type: string;
  status: "published" | "cancelled";
  rating_rules_version: number;
  bibs_washed_by: string | null;
  attendance: Array<{ goals: number; player_id: string }> | null;
};

export default async function CorrectionPage({ params }: CorrectionPageProps) {
  await requireAdmin();
  const { sessionId } = await params;

  if (!isUuid(sessionId)) {
    notFound();
  }

  const supabase = await createClient();
  const [sessionResponse, playersResponse, correctionsResponse, statusEventsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("match_sessions")
      .select("id, session_date, session_type, status, rating_rules_version, bibs_washed_by, attendance(player_id, goals)")
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
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Correction</p>
          <h1 className="text-4xl font-black tracking-tight">{session.status === "cancelled" ? "Review cancelled session" : "Correct published session"}</h1>
          <p className="text-ink-dim">
            {session.status === "cancelled"
              ? "You can update this record before reactivating it. It will not affect Live Ratings while cancelled."
              : "Update the original record carefully. Saving rebuilds Live Ratings immediately and preserves the prior record in the audit log."}
          </p>
        </header>

        {session.status === "published" && (
          <Link className="flex min-h-13 items-center justify-between rounded-xl border border-brass/50 bg-brass-bg/20 px-5 font-black text-brass" href={`/admin/attendance/${session.id}/reports`}>
            Session reports <span aria-hidden="true">&rarr;</span>
          </Link>
        )}

        <AttendanceForm
          correctionSession={{
            id: session.id,
            sessionDate: session.session_date,
            sessionType: session.session_type,
            status: session.status,
            ratingRulesVersion: session.rating_rules_version,
            bibsWashedBy: session.bibs_washed_by,
            attendance: session.attendance ?? [],
          }}
          players={correctionPlayers}
        />

        {corrections.length > 0 && (
          <section className="space-y-3 border-t border-panel-2 pt-8">
            <h2 className="display text-2xl">Correction history</h2>
            <ul className="space-y-2">
              {corrections.map((correction) => (
                <li className="rounded-xl bg-panel p-4 text-sm text-ink-dim" key={correction.id}>
                  <p className="font-semibold text-ink">{correction.reason}</p>
                  <p className="mt-1">{new Date(correction.corrected_at).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {statusEvents.length > 0 && (
          <section className="space-y-3 border-t border-panel-2 pt-8">
            <h2 className="display text-2xl">Status history</h2>
            <ul className="space-y-2">
              {statusEvents.map((event) => (
                <li className="rounded-xl bg-panel p-4 text-sm text-ink-dim" key={event.id}>
                  <p className="font-semibold capitalize text-ink">{event.event_type}</p>
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
