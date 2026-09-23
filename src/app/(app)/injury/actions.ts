"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type CheckInState = { ok: true; message: string } | { ok: false; error: string } | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Weekly rehab check-in (ADR-082). The server decides whether the week is
 * open, pays the stipend and protects the week; this action only relays.
 */
export async function checkInInjury(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  await requireUser();

  const weekStart = String(formData.get("week_start") ?? "");
  if (!ISO_DATE.test(weekStart)) return { ok: false, error: "Invalid week." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .rpc("injury_check_in", { p_week_start: weekStart });

  if (error) {
    if (error.code === "P0001") {
      return {
        ok: false,
        error: "This week isn't open for a check-in any more. Refresh to see where you stand.",
      };
    }
    return { ok: false, error: "Couldn't check in. Please try again." };
  }

  revalidatePath("/");
  const result = data as { checked_in?: boolean; amount?: number } | null;
  return result?.checked_in
    ? {
        ok: true,
        message: `Checked in: +${result.amount ?? 100} KUT Coins and your card is protected this week.`,
      }
    : { ok: true, message: "You had already checked in for that week." };
}
