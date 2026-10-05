import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { enabledProfile } from "@/lib/auth/profile-read";
import { isAdminRole } from "@/lib/auth/roles";
import { competeStatus, isPickingOpen, type MidweekCurrent } from "@/lib/midweek/entry";
import type { CompeteStatus } from "./routes";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NavContext = {
  displayName: string;
  isAdmin: boolean;
  /**
   * null means the wallet could not be read, not that the member has no coins.
   * A failed read used to collapse to 0 (KB-014) — the one value the nav can
   * show that was never a real balance — so callers must render it as unknown.
   */
  balance: number | null;
  unreadCount: number;
  incomingOfferCount: number;
  /** Compete's badge (ADR-107); null shows none, including when a read failed. */
  competeStatus: CompeteStatus | null;
};

/**
 * Compete's badge. Tolerant like every Midweek entry point (ADR-097): a failed
 * or denied read shows no badge and never fails the page. The squad is read
 * only while picking is open, the one time it matters.
 */
async function loadCompeteStatus(supabase: SupabaseServerClient): Promise<CompeteStatus | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_current")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  const current = data as MidweekCurrent;
  const now = new Date();
  let hasSavedFive: boolean | null = null;
  if (current.tournament_id && !current.opted_out && isPickingOpen(current, now)) {
    const squad = await supabase
      .schema("kut")
      .from("my_midweek_squad")
      .select("slot", { count: "exact", head: true })
      .eq("tournament_id", current.tournament_id);
    hasSavedFive = squad.error ? null : (squad.count ?? 0) > 0;
  }
  return competeStatus(current, hasSavedFive, now);
}

/**
 * Powers the persistent AppNav shell. Separate from requireUser/requireAdmin,
 * which pages still call for their own auth checks — this only decides what
 * the nav chrome shows and redirects unauthenticated/disabled visitors.
 */
export const getNavContext = cache(async (): Promise<NavContext> => {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const [profileResponse, walletResponse, notificationsResponse, offersResponse, compete] =
    await Promise.all([
      supabase
        .schema("kut")
        .from("profiles")
        .select("display_name, role, is_disabled, starter_claimed_at, starter_opened_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
      supabase
        .schema("kut")
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      supabase
        .schema("kut")
        .from("my_trade_offers")
        .select("offer_id", { count: "exact", head: true })
        .eq("is_outgoing", false)
        .eq("status", "active"),
      loadCompeteStatus(supabase).catch(() => null),
    ]);

  const profile = enabledProfile(profileResponse, "nav");
  if (!profile) {
    redirect("/login");
  }

  // A wallet read can fail on its own without the page being unusable, so the
  // nav degrades to "unknown" rather than throwing the whole shell away. What
  // it must never do is state a balance the member does not have.
  if (walletResponse.error) {
    console.error("nav wallet read failed", walletResponse.error);
  }

  // First-login gate: a member whose starter pack was granted but never opened
  // is held at the full-screen /welcome reveal (see ADR-031).
  if (profile.starter_claimed_at && !profile.starter_opened_at) {
    redirect("/welcome");
  }

  return {
    displayName: profile.display_name,
    isAdmin: isAdminRole(profile.role),
    balance: walletResponse.error ? null : (walletResponse.data?.balance ?? 0),
    unreadCount: notificationsResponse.count ?? 0,
    incomingOfferCount: offersResponse.count ?? 0,
    competeStatus: compete,
  };
});
