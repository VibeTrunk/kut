"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type OpenPackState = {
  error: string | null;
  priceChanged?: boolean;
  currentPrice?: number;
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function openPack(
  _previousState: OpenPackState,
  formData: FormData,
): Promise<OpenPackState> {
  await requireUser();
  const packSlug = String(formData.get("packSlug") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const expectedPrice = Number(formData.get("expectedPrice"));

  if (!slugPattern.test(packSlug) || !isUuid(idempotencyKey) || !Number.isSafeInteger(expectedPrice) || expectedPrice <= 0) {
    return { error: "This pack request was invalid. Please refresh and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("open_pack", {
    p_pack_slug: packSlug,
    p_expected_price: expectedPrice,
    p_idempotency_key: idempotencyKey,
  });

  if (!error && data && typeof data === "object" && "price_changed" in data && data.price_changed === true) {
    const currentPrice = "current_price" in data ? Number(data.current_price) : Number.NaN;
    return Number.isSafeInteger(currentPrice) && currentPrice > 0
      ? { error: null, priceChanged: true, currentPrice }
      : { error: "The pack price changed. Refresh and confirm the new price." };
  }

  if (error || !data || typeof data !== "object" || !("opening_id" in data) || typeof data.opening_id !== "string") {
    return { error: "The pack could not be opened. Check your KUT Coin balance and try again." };
  }

  revalidatePath("/club/packs", "layout");
  redirect(`/club/packs/${data.opening_id}`);
}
