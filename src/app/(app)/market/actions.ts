"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { ECONOMY } from "@/game/economy";
import { createClient } from "@/lib/supabase/server";

export type BuyState = { error: string | null };
export type OfferState = { error: string | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function buyListing(_state: BuyState, formData: FormData): Promise<BuyState> {
  await requireUser();
  const listingId = String(formData.get("listingId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!uuidPattern.test(listingId) || !uuidPattern.test(idempotencyKey)) return { error: "This purchase request was invalid." };
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("buy_listing", { p_listing_id: listingId, p_idempotency_key: idempotencyKey });
  if (error || !data || typeof data !== "object" || !("price" in data)) return { error: "This listing could not be bought. It may have sold or you may need more KUT Coins." };
  const price = Number(data.price);
  if (!Number.isSafeInteger(price) || price < 1) return { error: "This listing could not be bought." };
  revalidatePath("/club/collection", "layout"); revalidatePath("/market", "layout"); revalidatePath("/messages");
  redirect(`/club/collection?purchase=${price}`);
}

export async function proposeOffer(_state: OfferState, formData: FormData): Promise<OfferState> {
  await requireUser();
  const listingId = String(formData.get("listingId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!uuidPattern.test(listingId) || !uuidPattern.test(idempotencyKey)) return { error: "This offer request was invalid." };

  const offeredCoins = Number(formData.get("offeredCoins") ?? 0);
  if (!Number.isSafeInteger(offeredCoins) || offeredCoins < 0) return { error: "Enter a whole number of KUT Coins to offer (0 or more)." };

  const offeredCardIds = formData.getAll("cardId").map((value) => String(value)).filter((value) => uuidPattern.test(value));
  const uniqueCardIds = [...new Set(offeredCardIds)];
  if (uniqueCardIds.length > ECONOMY.tradeOfferMaxCards) {
    return { error: `An offer can include at most ${ECONOMY.tradeOfferMaxCards} cards.` };
  }
  if (offeredCoins === 0 && uniqueCardIds.length === 0) {
    return { error: "Offer at least some KUT Coins or one card." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("propose_trade", {
    p_listing_id: listingId,
    p_offered_coins: offeredCoins,
    p_offered_card_ids: uniqueCardIds,
    p_idempotency_key: idempotencyKey,
  });
  if (error || !data || typeof data !== "object" || !("offer_id" in data)) {
    return { error: "This offer could not be made. Check your balance and that the listing is still active." };
  }
  revalidatePath("/market", "layout"); revalidatePath("/club/collection", "layout"); revalidatePath("/messages");
  redirect("/market/offers?sent=1");
}

export async function withdrawOffer(_state: OfferState, formData: FormData): Promise<OfferState> {
  await requireUser();
  const offerId = String(formData.get("offerId") ?? "");
  if (!uuidPattern.test(offerId)) return { error: "This request was invalid." };
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("withdraw_trade", { p_offer_id: offerId });
  if (error) return { error: "This offer could not be withdrawn. It may already have been answered." };
  revalidatePath("/market", "layout"); revalidatePath("/club/collection", "layout"); revalidatePath("/messages");
  redirect("/market/offers?withdrawn=1");
}

export async function respondToOffer(_state: OfferState, formData: FormData): Promise<OfferState> {
  await requireUser();
  const offerId = String(formData.get("offerId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";
  if (!uuidPattern.test(offerId) || !uuidPattern.test(idempotencyKey)) return { error: "This response was invalid." };
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("respond_to_trade", {
    p_offer_id: offerId,
    p_accept: accept,
    p_idempotency_key: idempotencyKey,
  });
  if (error || !data || typeof data !== "object" || !("status" in data)) {
    return { error: "This offer could not be updated. It may have expired or the listing may no longer be active." };
  }
  revalidatePath("/market", "layout"); revalidatePath("/club/collection", "layout"); revalidatePath("/messages");
  redirect(`/market/offers?${accept ? "accepted" : "declined"}=1`);
}
