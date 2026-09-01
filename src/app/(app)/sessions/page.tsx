import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sessions" };

type PublishedSession = {
  id: string;
  session_date: string;
  session_type: string;
  attendee_count: number;
  goal_count: number;
};

const TYPE_LABEL: Record<string, string> = { monday: "Monday", friday: "Friday", other: "Session" };

function weekday(dateISO: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(dateISO));
}

export default async function SessionsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("published_sessions")
    .select("id, session_date, session_type, attendee_count, goal_count")
    .order("session_date", { ascending: false });

  if (error) throw new Error("Could not load the published sessions.");
  const sessions = (data ?? []) as PublishedSession[];

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">KUT football</p>
          <h1 className="display text-5xl sm:text-6xl">Published sessions</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Every session the admin has published. Publishing a session&rsquo;s attendance is what moves Live Ratings.
          </p>
        </header>

        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center text-ink-dim">
            No sessions have been published yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-2xl border border-line/60 bg-panel/60 p-5 hover:border-brass/60"
                  href={`/sessions/${session.id}`}
                >
                  <span className="min-w-0">
                    <span className="block font-extrabold">{formatDate(session.session_date)}</span>
                    <span className="block text-xs text-ink-faint">
                      {weekday(session.session_date)} &middot; {TYPE_LABEL[session.session_type] ?? "Session"}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-ink-dim">
                    {session.attendee_count} in &middot; {session.goal_count} goals
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
