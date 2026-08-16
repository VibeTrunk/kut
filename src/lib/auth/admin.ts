import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  displayName: string;
  role: "admin" | "superadmin";
};

export async function requireAdmin(): Promise<AdminIdentity> {
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
    (profile.role !== "admin" && profile.role !== "superadmin")
  ) {
    redirect("/");
  }

  return {
    id: userId,
    displayName: profile.display_name,
    role: profile.role,
  };
}
