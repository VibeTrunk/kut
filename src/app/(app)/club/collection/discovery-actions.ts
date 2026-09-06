"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export async function setCardWant(formData: FormData) {
  await requireUser();
  const editionId = String(formData.get("editionId") ?? "");
  const wanted = formData.get("wanted") === "true";
  if (!isUuid(editionId)) throw new Error("Invalid edition.");
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_card_want", { p_edition_id: editionId, p_wanted: wanted });
  if (error) throw new Error("Could not update your wanted cards.");
  revalidatePath("/club/collection", "layout");
}

export async function setTradeAvailability(formData: FormData) {
  await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  const available = formData.get("available") === "true";
  if (!isUuid(cardId)) throw new Error("Invalid card.");
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_trade_availability", { p_card_id: cardId, p_available: available });
  if (error) throw new Error("Could not update this card. Listed or offered cards cannot be shared.");
  revalidatePath("/club/collection", "layout");
}
