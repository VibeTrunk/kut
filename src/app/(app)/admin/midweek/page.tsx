import Link from "next/link";
import { MidweekSeed } from "@/components/midweek/seed";
import { requireAdmin } from "@/lib/auth/admin";
import { statusWord, type MidweekAdminOverview } from "@/lib/midweek/admin";
import { formatClock, formatDayDate, formatSavedAt, formatShortLock } from "@/lib/midweek/entry";
import { createClient } from "@/lib/supabase/server";
import { MidweekRehearsalPanel, MidweekSwitch, MidweekVoidForm } from "./controls";

export const metadata = { title: "Admin · Midweek Madness" };

const PANEL = "rounded-2xl border border-line/60 bg-panel/60 p-5 sm:p-6";

/**
 * `/admin/midweek` (Admin-Midweek, Admin-Void): the launch and pause switch,
 * this week at a glance from `kut.midweek_admin_overview`, the rehearsal, and
 * void before payout (`?void=1`). There is no weekly admin work (§44.11); this
 * is for launching, pausing and the rare correction.
 */
export default async function AdminMidweekPage({
  searchParams,
}: {
  searchParams: Promise<{ void?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data, error }, query] = await Promise.all([
    supabase.schema("kut").from("midweek_admin_overview").select("*").maybeSingle(),
    searchParams,
  ]);

  if (error || !data) {
    // Vercel deploys before a hosted push; say so rather than fail the tab.
    if (error) console.error("midweek admin overview read failed", error.code, error.message);
    return (
      <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
        <section className="mx-auto max-w-2xl space-y-4">
          <h1 className="display text-4xl">Midweek Madness</h1>
          <p className="text-ink-dim">
            Midweek Madness isn&rsquo;t available on this database yet.
          </p>
        </section>
      </main>
    );
  }

  const overview = data as MidweekAdminOverview;
  const week = overview.lock_at ? formatDayDate(overview.lock_at) : null;

  if (query.void === "1" && overview.tournament_id && overview.lock_at && week) {
    const voidable = overview.status === "open" || overview.status === "simulated";
    const finalAt = overview.final_reveal_at ? ` at ${formatClock(overview.final_reveal_at)}` : "";
    return (
      <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
        <section className="mx-auto grid max-w-2xl gap-8">
          <header className="grid gap-3">
            <Link className="text-sm font-bold text-brass hover:underline" href="/admin/midweek">
              &larr; Midweek
            </Link>
            <h1 className="display text-3xl sm:text-5xl">Void {week}</h1>
          </header>
          {voidable ? (
            <section
              aria-labelledby="void-h"
              className="grid gap-4 rounded-2xl border border-brick-line bg-brick-bg/50 p-5 sm:p-6"
            >
              <p className="text-[13px] leading-relaxed text-ink-dim" id="void-h">
                <b className="text-ink">Status: {statusWord(overview.status).toLowerCase()}.</b>{" "}
                Voiding hides every result of this week, including rounds already shown, and pays
                nobody. It can&rsquo;t be undone, and it can&rsquo;t re-run the week. It&rsquo;s
                possible until the coins are paid after the final{finalAt}.
              </p>
              <MidweekVoidForm
                lockAt={overview.lock_at}
                tournamentId={overview.tournament_id}
                weekLabel={week}
              />
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-line bg-panel/35 p-5 text-[13px] text-ink-dim sm:p-6">
              {overview.status === "complete" ? (
                <>
                  {week} has been paid, so it can&rsquo;t be voided. Correct a member&rsquo;s coins
                  with a wallet adjustment in{" "}
                  <Link className="font-bold text-brass hover:underline" href="/admin/economy">
                    Economy
                  </Link>
                  .
                </>
              ) : overview.status === "void" ? (
                <>
                  {week} is void. Members see your reason instead of its results, and nobody was
                  paid for it.
                </>
              ) : (
                <>{week} didn&rsquo;t run, so there is nothing to void.</>
              )}
            </section>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto grid max-w-6xl gap-8">
        <h1 className="display text-4xl sm:text-6xl">Midweek Madness</h1>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div className="grid min-w-0 gap-6">
            <MidweekSwitch enabled={overview.enabled} />
            <section aria-labelledby="this-week-h" className={`${PANEL} grid gap-3.5`}>
              <h2 className="text-lg font-black" id="this-week-h">
                This week{week ? ` · ${week}` : ""}
              </h2>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/60 bg-line/45 [&>div]:bg-panel [&>div]:px-3.5 [&>div]:py-3">
                <div>
                  <dt className="text-[10.4px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                    Status
                  </dt>
                  <dd className="mt-0.5 text-lg font-black">{statusWord(overview.status)}</dd>
                </div>
                <div>
                  <dt className="text-[10.4px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                    Locks
                  </dt>
                  <dd className="mt-0.5 text-lg font-black">
                    {overview.lock_at ? formatShortLock(overview.lock_at) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.4px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                    Squads saved
                  </dt>
                  <dd className="mt-0.5 text-[22px] font-black tabular-nums">
                    {overview.squads_saved ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10.4px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                    Opted out
                  </dt>
                  <dd className="mt-0.5 text-[22px] font-black tabular-nums">
                    {overview.opted_out ?? 0}
                  </dd>
                </div>
              </dl>
              {overview.seed_hash && <MidweekSeed seedHash={overview.seed_hash} />}
              {overview.last_run_at && (
                <p className="text-xs text-ink-faint">
                  The worker last ran {formatSavedAt(overview.last_run_at)}.
                  {overview.last_run_error && (
                    <span className="mt-1 block font-mono text-warning">
                      {overview.last_run_error}
                    </span>
                  )}
                </p>
              )}
              {overview.tournament_id && (
                <Link
                  className="inline-flex min-h-11 items-center text-sm font-bold text-brass hover:underline"
                  href="/admin/midweek?void=1"
                >
                  Void this week&hellip;
                </Link>
              )}
            </section>
          </div>
          <div className="min-w-0">
            <MidweekRehearsalPanel />
          </div>
        </div>
      </section>
    </main>
  );
}
