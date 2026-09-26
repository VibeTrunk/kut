import { createServiceClient } from "@/lib/supabase/service";

// The lazy trigger for Midweek Madness (BUILD_SPEC §44.11, ADR-098).
// `kut.run_midweek_due` is an idempotent, service-role-only worker that opens,
// locks and completes weeks; there is no scheduler (ADR-061), so the pages a
// member opens on a Wednesday evening nudge it: Home and every Midweek page.
// Each page calls this before its own reads, so a visit at 20:01 already sees
// the locked week. The worker claims rows `for update skip locked`, so
// overlapping page loads do the work once.

// Skip re-attempting within this window in a warm server process. Serverless
// spreads load across instances, so this is a best-effort damper, not a lock;
// the count below and the worker's own claims are the real guard.
const MIN_ATTEMPT_INTERVAL_MS = 60_000;
let lastAttemptAt = 0;

type DueRow = { status: string; lock_at: string; final_reveal_at: string | null };

/**
 * Whether the worker has anything to do: an open week whose lock has passed,
 * a simulated week whose final is out, or the switch on with no week running
 * (the open step).
 */
export function hasDueMidweekWork(rows: readonly DueRow[], enabled: boolean, now: Date): boolean {
  const at = now.getTime();
  const running = rows.filter((row) => row.status === "open" || row.status === "simulated");
  if (enabled && running.length === 0) return true;
  return running.some((row) =>
    row.status === "open"
      ? Date.parse(row.lock_at) <= at
      : row.final_reveal_at !== null && Date.parse(row.final_reveal_at) <= at,
  );
}

export async function runDueMidweek(): Promise<void> {
  const now = Date.now();
  if (now - lastAttemptAt < MIN_ATTEMPT_INTERVAL_MS) return;
  lastAttemptAt = now;

  try {
    const supabase = createServiceClient();
    const [config, running] = await Promise.all([
      supabase.schema("kut").from("midweek_config").select("enabled").maybeSingle(),
      supabase
        .schema("kut")
        .from("midweek_tournaments")
        .select("status, lock_at, final_reveal_at")
        .in("status", ["open", "simulated"]),
    ]);
    if (config.error) throw config.error;
    if (running.error) throw running.error;
    const enabled = Boolean((config.data as { enabled?: boolean } | null)?.enabled);
    if (!hasDueMidweekWork((running.data ?? []) as DueRow[], enabled, new Date())) return;

    const { error } = await supabase.schema("kut").rpc("run_midweek_due", { p_batch_limit: 5 });
    if (error) throw error;
  } catch (error) {
    // A worker hiccup must never break the page it was invoked from; the
    // worker records its own errors in kut.midweek_jobs, and the next visit
    // retries.
    console.error("runDueMidweek failed", error);
  }
}
