import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserIdentity = {
  id: string;
  displayName: string;
};

/**
 * Require an enabled KUT profile. This is intentionally separate from the
 * admin guard: any enabled member may see only their own collection.
 * Wrapped in React's cache() so the AppNav layout and a page's own call
 * within the same request share one Supabase round trip.
 */
export const requireUser = cache(async (): Promise<UserIdentity> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("display_name, is_disabled")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_disabled) {
    redirect("/");
  }

  return { id: userId, displayName: profile.display_name };
});
