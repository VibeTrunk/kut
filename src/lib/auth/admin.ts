import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "./roles";

export type AdminIdentity = {
  id: string;
  displayName: string;
  role: "admin" | "superadmin";
};

/** Cached per-request: the admin/layout.tsx guard and a page's own call share one round trip. */
export const requireAdmin = cache(async (): Promise<AdminIdentity> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("display_name, role, is_disabled")
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.is_disabled ||
    !isAdminRole(profile.role)
  ) {
    redirect("/");
  }

  return {
    id: userId,
    displayName: profile.display_name,
    role: profile.role,
  };
});
