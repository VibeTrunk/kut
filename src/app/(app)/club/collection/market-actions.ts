"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type ListingState = { error: string | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createListing(_state: ListingState, formData: FormData): Promise<ListingState> {
  await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  const price = Number(formData.get("price"));
  if (!uuidPattern.test(cardId) || !Number.isSafeInteger(price) || price < 1) {
    return { error: "Enter a whole-number price for this card." };
  }
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("create_listing", { p_card_id: cardId, p_price: price });
  if (error) return { error: "This listing could not be created. Check the current price range and try again." };
  revalidatePath("/club/collection", "layout"); revalidatePath("/market"); revalidatePath(`/club/collection/${cardId}`);
  redirect(`/club/collection/${cardId}?listed=1`);
}

export async function cancelListing(_state: ListingState, formData: FormData): Promise<ListingState> {
  await requireUser();
  const cardId = String(formData.get("cardId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  if (!uuidPattern.test(cardId) || !uuidPattern.test(listingId)) return { error: "This cancellation request was invalid." };
  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("cancel_listing", { p_listing_id: listingId });
  if (error) return { error: "This listing could not be cancelled. It may no longer be active." };
  revalidatePath("/club/collection", "layout"); revalidatePath("/market"); revalidatePath(`/club/collection/${cardId}`);
  redirect(`/club/collection/${cardId}?listingCancelled=1`);
}
