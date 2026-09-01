"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export async function saveClubName(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  await requireUser();

  const raw = String(formData.get("club_name") ?? "").trim();
  if (raw.length > 80) {
    return { ok: false, error: "Club name must be 80 characters or fewer." };
  }

  const supabase = await createClient();
  // An empty string resets to NULL server-side (-> the "<name>'s Club" default).
  const { error } = await supabase.schema("kut").rpc("set_own_club_name", { p_club_name: raw });
  if (error) {
    if (error.code === "22023") {
      return { ok: false, error: "That club name wasn't accepted. Keep it to 80 plain characters." };
    }
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/leaderboard");
  return { ok: true, message: raw === "" ? "Club name reset to the default." : "Club name saved." };
}
