"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type DiscardState = { error: string | null };

export async function discardCard(
  _previousState: DiscardState,
  formData: FormData,
): Promise<DiscardState> {
  await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");

  if (!isUuid(cardId) || !isUuid(idempotencyKey)) {
    return { error: "This discard request was invalid. Please refresh the card and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("discard_card", {
    p_card_id: cardId,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data || typeof data !== "object" || !("coins" in data)) {
    return { error: "This card could not be discarded. It may be listed on the market or no longer available." };
  }

  const coins = Number(data.coins);
  if (!Number.isSafeInteger(coins) || coins <= 0) {
    return { error: "This card could not be discarded. Please try again." };
  }

  revalidatePath("/club/collection", "layout");
  revalidatePath(`/club/collection/${cardId}`);
  redirect(`/club/collection?discard=${coins}`);
}
