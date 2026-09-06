import { createServiceClient } from "@/lib/supabase/service";

// Lazy fallback for survey finalization. `kut.finalize_session_surveys` is a
// bounded, service-role-only worker that finalizes surveys whose 24h window has
// closed; there is no scheduled runner, so we nudge it from the two pages a
// member is most likely to open right after a session closes (the Chronicle
// week issue and their own session report). The RPC locks due rows
// `for update skip locked` and re-checks status, so overlapping page loads are
// safe. See ADR-061.

// Skip re-attempting within this window in a warm server process. Serverless
// spreads load across instances so this is a best-effort damper, not a lock;
// the `status='open' and closes_at<=now()` gate below is the real guard.
const MIN_ATTEMPT_INTERVAL_MS = 60_000;
let lastAttemptAt = 0;

export async function finalizeDueSurveys(): Promise<void> {
  const now = Date.now();
  if (now - lastAttemptAt < MIN_ATTEMPT_INTERVAL_MS) return;
  lastAttemptAt = now;

  try {
    const supabase = createServiceClient();
    const { count, error: countError } = await supabase
      .schema("kut")
      .from("session_surveys")
      .select("session_id", { count: "exact", head: true })
      .eq("status", "open")
      .lte("closes_at", new Date().toISOString());
    if (countError) throw countError;
    if (!count) return;

    const { error: rpcError } = await supabase
      .schema("kut")
      .rpc("finalize_session_surveys", { p_batch_limit: 20 });
    if (rpcError) throw rpcError;
  } catch (error) {
    // A finalization hiccup must never break the page it was invoked from.
    console.error("finalizeDueSurveys failed", error);
  }
}
