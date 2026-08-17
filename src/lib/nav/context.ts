import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type NavContext = {
  displayName: string;
  isAdmin: boolean;
  balance: number;
  unreadCount: number;
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

  const [profileResponse, walletResponse, notificationsResponse] = await Promise.all([
    supabase.schema("kut").from("profiles").select("display_name, role, is_disabled").eq("id", userId).maybeSingle(),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("user_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const profile = profileResponse.data;
  if (profileResponse.error || !profile || profile.is_disabled) {
    redirect("/login");
  }

  return {
    displayName: profile.display_name,
    isAdmin: profile.role === "admin" || profile.role === "superadmin",
    balance: walletResponse.data?.balance ?? 0,
    unreadCount: notificationsResponse.count ?? 0,
  };
});
