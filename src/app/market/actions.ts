"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type BuyState = { error: string | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function buyListing(_state: BuyState, formData: FormData): Promise<BuyState> {
  await requireUser();
  const listingId = String(formData.get("listingId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!uuidPattern.test(listingId) || !uuidPattern.test(idempotencyKey)) return { error: "This purchase request was invalid." };
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("buy_listing", { p_listing_id: listingId, p_idempotency_key: idempotencyKey });
  if (error || !data || typeof data !== "object" || !("price" in data)) return { error: "This listing could not be bought. It may have sold or you may need more TF Coins." };
  const price = Number(data.price);
  if (!Number.isSafeInteger(price) || price < 1) return { error: "This listing could not be bought." };
  revalidatePath("/club"); revalidatePath("/market"); revalidatePath("/messages");
  redirect(`/club?purchase=${price}`);
}
