import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type NavContext = {
  displayName: string;
  isAdmin: boolean;
  balance: number;
  unreadCount: number;
  incomingOfferCount: number;
};

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

  const [profileResponse, walletResponse, notificationsResponse, offersResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("profiles")
      .select("display_name, role, is_disabled, starter_claimed_at, starter_opened_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("user_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase
      .schema("kut")
      .from("my_trade_offers")
      .select("offer_id", { count: "exact", head: true })
      .eq("is_outgoing", false)
      .eq("status", "active"),
  ]);

  const profile = profileResponse.data;
  if (profileResponse.error || !profile || profile.is_disabled) {
    redirect("/login");
  }

  // First-login gate: a member whose starter pack was granted but never opened
  // is held at the full-screen /welcome reveal (see ADR-031).
  if (profile.starter_claimed_at && !profile.starter_opened_at) {
    redirect("/welcome");
  }

  return {
    displayName: profile.display_name,
    isAdmin: profile.role === "admin" || profile.role === "superadmin",
    balance: walletResponse.data?.balance ?? 0,
    unreadCount: notificationsResponse.count ?? 0,
    incomingOfferCount: offersResponse.count ?? 0,
  };
});
