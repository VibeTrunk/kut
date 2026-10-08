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
  // Every page: Compete's badge rides the nav (ADR-107), and the picker,
  // Home's card and the Settings opt-out panel read the same state.
  revalidatePath("/", "layout");
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
          ? "Only active FLUT members can take part."
          : "Something went wrong. Please try again.",
    };
  }

  revalidateMidweek();
  return {
    ok: true,
    message: optOut ? "You've opted out of Midweek Madness." : "You're taking part again.",
  };
}

export type CallSaveResult = { ok: true; savedAt: string } | { ok: false; message: string | null };

/**
 * A call (ADR-118): the caller's pick for one later match, or with a null
 * winner its removal. Every rule lives in `kut.save_midweek_prediction` and
 * its trigger; a refusal's message goes back for `callError` to word. Nothing
 * is revalidated: the card keeps its own state, and the evening page asks
 * for itself again while a match is in play.
 */
export async function saveMidweekCall(
  tournamentId: string,
  round: number,
  pairing: number,
  winnerUserId: string | null,
): Promise<CallSaveResult> {
  await requireUser();
  if (
    !isUuid(tournamentId) ||
    !Number.isInteger(round) ||
    !Number.isInteger(pairing) ||
    (winnerUserId !== null && !isUuid(winnerUserId))
  ) {
    return { ok: false, message: null };
  }
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("save_midweek_prediction", {
    p_tournament_id: tournamentId,
    p_round: round,
    p_pairing: pairing,
    p_winner_user_id: winnerUserId,
  });
  if (error) return { ok: false, message: error.message ?? null };
  return { ok: true, savedAt: new Date().toISOString() };
}
