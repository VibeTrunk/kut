import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Session" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPE_LABEL: Record<string, string> = { monday: "Monday", friday: "Friday", other: "Session" };

type SessionRow = {
  id: string;
  session_date: string;
  session_type: string;
  published_at: string;
  bibs_washed_by: string | null;
};

type AttendanceRow = {
  player_id: string;
  goals: number;
  players: { display_name: string; slug: string } | null;
};

export default async function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireUser();
  const { sessionId } = await params;
  if (!UUID_RE.test(sessionId)) notFound();

  const supabase = await createClient();
  const [sessionResponse, attendanceResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("match_sessions")
      .select("id, session_date, session_type, published_at, bibs_washed_by")
      .eq("id", sessionId)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("attendance")
      .select("player_id, goals, players(display_name, slug)")
      .eq("session_id", sessionId),
  ]);

  if (sessionResponse.error || attendanceResponse.error) {
    throw new Error("Could not load this session.");
  }
  const session = sessionResponse.data as SessionRow | null;
  if (!session) notFound();

  const attendance = (attendanceResponse.data ?? []) as unknown as AttendanceRow[];
  const roster = attendance
    .slice()
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        (a.players?.display_name ?? "").localeCompare(b.players?.display_name ?? ""),
    );
  const totalGoals = attendance.reduce((sum, row) => sum + row.goals, 0);
  const bibsBringer = session.bibs_washed_by
    ? attendance.find((row) => row.player_id === session.bibs_washed_by)?.players?.display_name ?? null
    : null;

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/sessions">
          &larr; Sessions
        </Link>

        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
            {TYPE_LABEL[session.session_type] ?? "Session"} &middot; published {formatDate(session.published_at)}
          </p>
          <h1 className="display text-5xl sm:text-6xl">{formatDate(session.session_date)}</h1>
          <p className="text-base text-ink-dim">
            {attendance.length} attended &middot; {totalGoals} goals scored
            {bibsBringer ? (
              <>
                {" "}
                &middot; bibs brought by <span className="font-bold text-ink">{bibsBringer}</span>
              </>
            ) : null}
          </p>
        </header>

        {roster.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
            No attendance was recorded for this session.
          </p>
        ) : (
          <ol>
            {roster.map((row) => (
              <li
                className="flex items-baseline justify-between gap-4 border-b border-line/30 py-3"
                key={row.player_id}
              >
                <span className="min-w-0 truncate font-semibold">
                  {row.players?.slug ? (
                    <Link className="hover:text-brass hover:underline" href={`/players/${row.players.slug}`}>
                      {row.players.display_name}
                    </Link>
                  ) : (
                    row.players?.display_name ?? "A player"
                  )}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-ink-faint">
                  {row.goals > 0 ? `${row.goals} ${row.goals === 1 ? "goal" : "goals"}` : "—"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
