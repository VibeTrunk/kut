"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StarterClaimState = { error: string | null };

export async function claimStarterPack(
  _previousState: StarterClaimState,
  _formData: FormData,
): Promise<StarterClaimState> {
  void _previousState;
  void _formData;
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || typeof data?.claims?.sub !== "string") {
    redirect("/login");
  }

  const { error } = await supabase.schema("kut").rpc("claim_starter_pack");

  if (error) {
    return { error: "Your starter pack could not be claimed. Please try again." };
  }

  revalidatePath("/");
  redirect("/?starter=1");
}
