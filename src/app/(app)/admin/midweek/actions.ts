"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  isValidVoidNote,
  switchError,
  voidError,
  type MidweekRehearsal,
} from "@/lib/midweek/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/**
 * `/admin/midweek`'s three controls (§44.8): the launch and pause switch, the
 * rehearsal (writes nothing) and void before payout. Each is an admin-only
 * RPC that checks `kut.is_admin()` itself; these only guard the input and put
 * a refusal into words.
 */

export type AdminActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export type RehearsalState =
  { ok: true; rehearsal: MidweekRehearsal } | { ok: false; error: string } | null;

function revalidateMidweek() {
  revalidatePath("/admin/midweek");
  revalidatePath("/club/midweek");
  revalidatePath("/");
  revalidatePath("/club/collection");
  revalidatePath("/settings");
}

export async function setMidweekEnabled(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const value = formData.get("enabled");
  if (value !== "true" && value !== "false") {
    return { ok: false, error: "That choice wasn't accepted. Please try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .schema("kut")
    .rpc("admin_set_midweek_enabled", { p_enabled: value === "true" });
  if (error) return { ok: false, error: switchError(error.code) };
  revalidateMidweek();
  return {
    ok: true,
    message: value === "true" ? "Midweek Madness is running." : "Midweek Madness is paused.",
  };
}

export async function runMidweekRehearsal(): Promise<RehearsalState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_midweek_rehearsal");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Only admins can run a rehearsal."
          : "The rehearsal failed. Please try again.",
    };
  }
  return { ok: true, rehearsal: data as MidweekRehearsal };
}

export async function voidMidweekWeek(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const note = String(formData.get("note") ?? "");
  const lockAt = String(formData.get("lock_at") ?? "") || null;
  if (!isUuid(tournamentId)) return { ok: false, error: voidError("P0002", undefined, lockAt) };
  if (!isValidVoidNote(note)) return { ok: false, error: voidError("22023", undefined, lockAt) };
  if (formData.get("confirm") !== "on") {
    return { ok: false, error: "Tick the box to confirm that nobody is paid for this week." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .schema("kut")
    .rpc("admin_void_midweek", { p_tournament_id: tournamentId, p_note: note.trim() });
  if (error) return { ok: false, error: voidError(error.code, error.message, lockAt) };
  revalidateMidweek();
  return { ok: true, message: "Voided. Members see your reason instead of the results." };
}
