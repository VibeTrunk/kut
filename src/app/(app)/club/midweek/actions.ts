"use server";

import { revalidatePath } from "next/cache";
import { MIDWEEK } from "@/game/midweek/config";
import { requireUser } from "@/lib/auth/user";
import { formatWeekday, squadSaveError } from "@/lib/midweek/entry";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type MidweekActionState =
  { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateMidweek() {
  revalidatePath("/club/midweek");
  revalidatePath("/"); // the Home card
  revalidatePath("/club/collection"); // the strip
  revalidatePath("/settings"); // the opt-out panel's wording
}

export async function saveMidweekSquad(
  _prev: MidweekActionState,
  formData: FormData,
): Promise<MidweekActionState> {
  await requireUser();

  const cardIds = formData.getAll("card_id").map(String);
  if (
    cardIds.length < 1 ||
    cardIds.length > MIDWEEK.squadSize ||
    !cardIds.every(isUuid) ||
    new Set(cardIds).size !== cardIds.length
  ) {
    return { ok: false, error: squadSaveError("22023", undefined) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .rpc("save_midweek_squad", { p_card_ids: cardIds });
  if (error) {
    return { ok: false, error: squadSaveError(error.code, error.message) };
  }

  revalidateMidweek();
  const lockAt = (data as { lock_at?: string } | null)?.lock_at;
  return {
    ok: true,
    message: `Saved. Your five play on ${lockAt ? formatWeekday(lockAt) : "Wednesday"}.`,
  };
}

/** Opting out or back in (ADR-091), from the picker and from Settings. */
export async function setMidweekOptOut(
  _prev: MidweekActionState,
  formData: FormData,
): Promise<MidweekActionState> {
  await requireUser();

  const value = formData.get("opt_out");
  if (value !== "true" && value !== "false") {
    return { ok: false, error: "That choice wasn't accepted. Please try again." };
  }
  const optOut = value === "true";

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_midweek_opt_out", { p_opt_out: optOut });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Only active KUT members can take part."
          : "Something went wrong. Please try again.",
    };
  }

  revalidateMidweek();
  return {
    ok: true,
    message: optOut ? "You've opted out of Midweek Madness." : "You're taking part again.",
  };
}
