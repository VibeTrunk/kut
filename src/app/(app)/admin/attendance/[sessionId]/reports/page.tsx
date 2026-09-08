import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { correctGoals, finalizeReports } from "./actions";

type Props = { params: Promise<{ sessionId: string }> };
type Survey = {
  status: string;
  closes_at: string;
  finalized_at: string | null;
  finalized_reason: string | null;
};
type Row = {
  player_id: string;
  display_name: string;
  user_id: string | null;
  report_status: string | null;
  submitted_at: string | null;
  reported_goals: number | null;
  override_goals: number | null;
  has_override: boolean;
  reward_paid: boolean;
};
function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

export default async function AdminReportsPage({ params }: Props) {
  await requireAdmin();
  const { sessionId } = await params;
  const supabase = await createClient();
  const [surveyResponse, rosterResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("session_surveys")
      .select("status,closes_at,finalized_at,finalized_reason")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("admin_session_report_roster")
      .select(
        "player_id,display_name,user_id,report_status,submitted_at,reported_goals,override_goals,has_override,reward_paid",
      )
      .eq("session_id", sessionId)
      .order("display_name"),
  ]);
  if (surveyResponse.error || rosterResponse.error)
    throw new Error("Could not load session reports.");
  if (!surveyResponse.data) notFound();
  const rows = (rosterResponse.data ?? []) as Row[];
  const survey = surveyResponse.data as Survey;
  const eligible = rows.filter((r) => r.user_id);
  const completed = eligible.filter((r) => r.report_status === "submitted").length;
  const guests = rows.length - eligible.length;
  const pending = eligible.length - completed;
  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-black text-brass" href={`/admin/attendance/${sessionId}`}>
          ← Session
        </Link>
        <header>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
            Admin · Reports
          </p>
          <h1 className="display mt-3 text-4xl sm:text-6xl">Session reports</h1>
          <p className="mt-3 text-sm text-ink-dim">
            {completed} of {eligible.length} forms completed · {guests} attendees without accounts.
            Goal coverage and rewards are shown separately.
          </p>
        </header>
        {survey.status === "open" ? (
          <section className="rounded-2xl border border-brass/40 bg-brass-bg/30 p-5">
            <h2 className="font-black text-brass">Close reporting now</h2>
            <p className="mt-2 text-sm text-ink-dim">
              Reporting closes on its own at {formatWhen(survey.closes_at)}. Closing it now scores
              the session immediately, rebuilds the ratings and publishes the results to the
              Chronicle — exactly what the deadline would have done.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink-dim">
              <li>
                <strong className="text-ink">
                  {completed} of {eligible.length}
                </strong>{" "}
                members have submitted a report.
              </li>
              <li>
                {pending === 0
                  ? "Nobody is still pending."
                  : `The ${pending} still pending can no longer submit, and no longer earn the 50 KUT Coins for it.`}
              </li>
              <li>
                Kudos are only recognised when at least three members submitted a report with
                nominations, and a category needs two nominations. Below that, nobody is recognised.
              </li>
            </ul>
            <form action={finalizeReports} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input name="sessionId" type="hidden" value={sessionId} />
              <label className="text-xs font-bold">
                Reason
                <input
                  className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base"
                  maxLength={500}
                  minLength={3}
                  name="reason"
                  placeholder="Everyone present has reported"
                  required
                />
              </label>
              <button className="min-h-11 self-end rounded-lg bg-brass px-4 font-black text-ink-on-accent">
                Close reporting
              </button>
            </form>
          </section>
        ) : survey.status === "finalized" ? (
          <p className="rounded-2xl border border-line bg-panel/60 p-5 text-sm text-ink-dim">
            Reporting closed{survey.finalized_at ? ` on ${formatWhen(survey.finalized_at)}` : ""}.
            {survey.finalized_reason
              ? ` Closed early by an admin: "${survey.finalized_reason}"`
              : " It ran its full 24 hours."}
          </p>
        ) : null}

        <div className="space-y-3">
          {rows.map((row) => (
            <article className="rounded-2xl border border-line bg-panel/60 p-5" key={row.player_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-black">{row.display_name}</h2>
                  <p className="mt-1 text-xs text-ink-faint">
                    {!row.user_id
                      ? "No account"
                      : row.report_status === "submitted"
                        ? `Submitted ${row.submitted_at ? new Date(row.submitted_at).toLocaleString("en-GB") : ""}`
                        : row.report_status === "draft"
                          ? "Draft"
                          : "Pending"}{" "}
                    ·{" "}
                    {row.reward_paid ? "Reward paid" : row.user_id ? "Not earned" : "Not eligible"}
                  </p>
                  <p className="mt-2 text-sm text-ink-dim">
                    Goals:{" "}
                    {row.has_override
                      ? `${row.override_goals} (admin correction)`
                      : (row.reported_goals ?? "Not reported")}
                  </p>
                </div>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-black text-brass">
                  {row.reported_goals === null && !row.has_override ? "Add goals" : "Edit goals"}
                </summary>
                <form
                  action={correctGoals}
                  className="mt-3 grid gap-3 rounded-xl bg-board/60 p-4 sm:grid-cols-[7rem_1fr_auto]"
                >
                  <input name="sessionId" type="hidden" value={sessionId} />
                  <input name="playerId" type="hidden" value={row.player_id} />
                  <label className="text-xs font-bold">
                    Goals
                    <input
                      className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base"
                      defaultValue={
                        row.has_override ? (row.override_goals ?? 0) : (row.reported_goals ?? 0)
                      }
                      max="99"
                      min="0"
                      name="goals"
                      type="number"
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Reason
                    <input
                      className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base"
                      maxLength={500}
                      minLength={3}
                      name="reason"
                      required
                    />
                  </label>
                  <button className="min-h-11 self-end rounded-lg bg-brass px-4 font-black text-ink-on-accent">
                    Save
                  </button>
                </form>
                {row.has_override && (
                  <form action={correctGoals} className="mt-2">
                    <input name="sessionId" type="hidden" value={sessionId} />
                    <input name="playerId" type="hidden" value={row.player_id} />
                    <input name="remove" type="hidden" value="true" />
                    <label className="block text-xs font-bold">
                      Reason to restore member report
                      <input
                        className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base"
                        maxLength={500}
                        minLength={3}
                        name="reason"
                        required
                      />
                    </label>
                    <button className="mt-2 min-h-11 rounded-lg border border-brick/50 px-4 text-sm font-black text-brick">
                      Remove correction
                    </button>
                  </form>
                )}
              </details>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
